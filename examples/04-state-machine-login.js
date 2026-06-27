//@::stateDiagram-v2

//@LoggedOut
class LoggedOutState {
  //@LoggedOut1:Exibir formulario de login
  displayLoginForm() {
    this.form.showEmailField();
    this.form.showPasswordField();
    this.form.showSubmitButton();
    this.form.showForgotPasswordLink();
  }

  //@LoggedOut1.1:Exibir link de cadastro
  displayRegisterLink() {
    this.form.showRegisterButton();
  }
}

//@LoggingIn
class LoggingInState {
  //@LoggingIn1:Validar credenciais
  async validateCredentials(email, password) {
    this.ui.showSpinner();
    const result = await this.authService.authenticate(email, password);
    if (result.locked) {
      this.transitionTo('AccountLocked');
      return;
    }
    if (!result.success) {
      this.incrementFailedAttempts();
      this.ui.showError('Invalid credentials');
      return;
    }
    this.transitionTo('TwoFactorAuth', { account: result.account });
  }

  //@LoggingIn1.1:Incrementar tentativas falhas
  incrementFailedAttempts() {
    this.failedAttempts++;
    if (this.failedAttempts >= 3) {
      this.ui.showCaptcha();
    }
    if (this.failedAttempts >= 5) {
      this.transitionTo('AccountLocked');
    }
  }
}

//@TwoFactorAuth
class TwoFactorAuthState {
  //@TwoFactorAuth1:Solicitar codigo 2FA
  onEnter() {
    this.ui.showCodeInput();
    this.ui.startTimer(300);
    this.sendCode();
  }

  //@TwoFactorAuth1.1:Enviar codigo
  async sendCode() {
    const method = this.context.account.twoFactorMethod;
    if (method === 'sms') {
      await this.smsService.send(this.context.account.phone);
    } else if (method === 'app') {
      this.ui.showAppInstructions();
    } else if (method === 'email') {
      await this.emailService.sendCode(this.context.account.email);
    }
  }

  //@TwoFactorAuth1.2:Verificar codigo
  async verifyCode(code) {
    const valid = await this.twoFactorService.validate(
      this.context.account.id,
      code
    );
    if (!valid) {
      this.ui.showError('Invalid code');
      this.twoFactorAttempts++;
      if (this.twoFactorAttempts >= 3) {
        this.transitionTo('AccountLocked');
      }
      return;
    }
    this.transitionTo('LoggedIn', { account: this.context.account });
  }
}

//@LoggedIn
class LoggedInState {
  //@LoggedIn1:Carregar dashboard
  async onEnter() {
    const account = this.context.account;
    await Promise.all([
      this.loadUserData(account.id),
      this.loadNotifications(account.id),
      this.startTokenRefreshTimer(),
    ]);
    this.ui.renderDashboard();
    this.analytics.track('login_success', { userId: account.id });
  }

  //@LoggedIn1.1:Iniciar refresh automatico do token
  startTokenRefreshTimer() {
    this.refreshInterval = setInterval(async () => {
      try {
        await this.sessionService.refreshToken();
      } catch (err) {
        this.transitionTo('SessionExpired');
      }
    }, 14 * 60 * 1000);
  }

  //@LoggedIn1.2:Realizar logout
  async logout() {
    clearInterval(this.refreshInterval);
    await this.sessionService.invalidateAll();
    this.transitionTo('LoggedOut');
  }
}


//@PasswordReset
class PasswordResetState {
  //@PasswordReset1:Solicitar reset
  async requestReset(email) {
    this.ui.showEmailInput();
    const result = await this.authService.requestPasswordReset(email);
    this.ui.showMessage('Check your email for reset instructions');
  }

  //@PasswordReset1.1:Confirmar reset
  async confirmReset(token, newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
      this.ui.showError('Passwords do not match');
      return;
    }
    if (!this.validatePasswordStrength(newPassword)) {
      this.ui.showError('Password is too weak');
      return;
    }
    const result = await this.authService.confirmReset(token, newPassword);
    if (!result.success) {
      this.ui.showError('Invalid or expired reset token');
      return;
    }
    this.ui.showMessage('Password reset successfully');
    this.transitionTo('LoggedOut');
  }
}

//@AccountLocked
class AccountLockedState {
  //@AccountLocked1:Exibir conta bloqueada
  onEnter() {
    const remaining = this.context.lockedUntil - Date.now();
    this.ui.showLockMessage(remaining);
    this.ui.showContactSupport();
    this.ui.showUnlockInstructions();
  }

  //@AccountLocked1.1:Verificar desbloqueio
  checkUnlock() {
    if (Date.now() > this.context.lockedUntil) {
      this.transitionTo('LoggedOut');
    }
  }

  //@AccountLocked1.2:Solicitar desbloqueio
  async requestUnlock() {
    await this.authService.sendUnlockEmail(this.context.email);
    this.ui.showMessage('Unlock instructions sent to your email');
  }
}

//@SessionExpired
class SessionExpiredState {
  //@SessionExpired1:Limpar sessao expirada
  async onEnter() {
    this.ui.showBanner('Your session has expired');
    await this.sessionService.clearSession();
    this.ui.clearPrivateData();
  }

  //@SessionExpired1.1:Redirecionar para login
  redirectToLogin() {
    const returnUrl = this.context.returnUrl;
    this.router.navigate('/login', { returnUrl });
  }
}

// Transicoes
//@LoggedOut->LoggingIn:User submits credentials
function submitLoginForm(email, password) {
  stateMachine.transition('LoggingIn', { email, password });
}

//@LoggingIn->LoggedIn:Login successful + 2FA verified
function loginComplete(account) {
  stateMachine.transition('LoggedIn', { account });
}

//@LoggingIn->TwoFactorAuth:2FA required
function requireTwoFactor(account) {
  stateMachine.transition('TwoFactorAuth', { account });
}

//@TwoFactorAuth->LoggedIn:2FA code verified
function twoFactorVerified(account) {
  stateMachine.transition('LoggedIn', { account });
}

//@TwoFactorAuth->AccountLocked:Too many failed 2FA attempts
function lockAfterFailed2FA() {
  stateMachine.transition('AccountLocked', { lockedUntil: Date.now() + 1800000 });
}

//@LoggingIn->AccountLocked:Too many failed attempts
function lockAfterFailedLogin() {
  stateMachine.transition('AccountLocked', { lockedUntil: Date.now() + 1800000 });
}

//@LoggedIn->SessionExpired:Token expired
function handleExpiredToken() {
  stateMachine.transition('SessionExpired', { returnUrl: window.location.pathname });
}

//@SessionExpired->LoggedOut:User redirected
function redirectAfterExpiry() {
  stateMachine.transition('LoggedOut');
}

//@LoggedOut->PasswordReset:Forgot password clicked
function initiatePasswordReset() {
  stateMachine.transition('PasswordReset');
}

//@PasswordReset->LoggedOut:Password reset complete
function resetComplete() {
  stateMachine.transition('LoggedOut');
}

//@AccountLocked->LoggedOut:Lock duration expired
function unlockAfterTimeout() {
  stateMachine.transition('LoggedOut');
}

//@LoggedIn->LoggedOut:User logged out
function performLogout() {
  stateMachine.transition('LoggedOut');
}
