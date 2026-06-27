//@::stateDiagram-v2

//@LoggedOut
class LoggedOutState {
  //@LoggedOut1:Show login form
  showForm() {
    this.ui.showEmailInput();
    this.ui.showPasswordInput();
    this.ui.showSubmitButton();
    this.ui.showRegisterLink();
  }
}

//@LoggingIn
class LoggingInState {
  //@LoggingIn1:Authenticate
  async authenticate(email, password) {
    this.ui.showSpinner();
    const user = await this.auth.findByEmail(email);
    
    if (user?.isLocked) {
      this.transitionTo('AccountLocked');
      return;
    }
    
    if (!user || !await this.auth.verifyPassword(password, user.hash)) {
      this.auth.incrementFailedAttempts(email);
      this.ui.showError();
      if (this.auth.getFailedAttempts(email) >= 5) {
        this.transitionTo('AccountLocked');
      } else {
        this.transitionTo('LoggedOut');
      }
      return;
    }
    
    this.transitionTo('TwoFactorAuth', { userId: user.id });
  }
}

//@TwoFactorAuth
class TwoFactorAuthState {
  //@TwoFactorAuth1:Verify code
  async verifyCode(inputCode) {
    const valid = this.twoFactorService.validate(inputCode);
    if (!valid) {
      this.attempts++;
      this.ui.showError();
      if (this.attempts >= 3) {
        this.transitionTo('AccountLocked');
      }
      return;
    }
    this.transitionTo('LoggedIn');
  }
}

//@LoggedIn
class LoggedInState {
  //@LoggedIn1:Show dashboard
  async onEnter(user) {
    this.user = user;
    await Promise.all([
      this.loadProfile(user.id),
      this.loadNotifications(user.id),
      this.startRefreshTimer()
    ]);
    this.ui.showDashboard();
  }

  //@LoggedIn1.1:Logout
  async logout() {
    clearInterval(this.refreshTimer);
    await this.session.invalidate();
    this.transitionTo('LoggedOut');
  }

  startRefreshTimer() {
    this.refreshTimer = setInterval(async () => {
      try {
        await this.session.refresh();
      } catch (err) {
        this.transitionTo('SessionExpired');
      }
    }, 900000);
  }
}

//@AccountLocked
class AccountLockedState {
  //@AccountLocked1:Show lock screen
  showScreen() {
    const remaining = Math.ceil((this.lockedUntil - Date.now()) / 60000);
    this.ui.showMessage(`Account locked. Try again in ${remaining} minutes`);
  }

  //@AccountLocked1.1:Request unlock email
  async requestUnlock() {
    await this.auth.sendUnlockEmail(this.userId);
    this.ui.showMessage('Unlock email sent');
  }
}

//@SessionExpired
class SessionExpiredState {
  //@SessionExpired1:Redirect to login
  redirectToLogin() {
    const returnUrl = window.location.pathname;
    this.router.navigate('/login', { returnUrl });
  }
}

//@LoggedOut->LoggingIn:Submit credentials
function submitLoginForm(email, password) {
  stateMachine.transition('LoggingIn', { email, password });
}

//@LoggingIn->TwoFactorAuth:Auth successful
function loginSuccessful(userId) {
  stateMachine.transition('TwoFactorAuth', { userId });
}

//@LoggingIn->AccountLocked:Too many failed attempts
function lockAccount(lockedUntil) {
  stateMachine.transition('AccountLocked', { lockedUntil });
}

//@LoggingIn->LoggedOut:Invalid credentials (retry)
function invalidCredentials() {
  stateMachine.transition('LoggedOut');
}

//@TwoFactorAuth->LoggedIn:2FA valid
function twoFactorSuccess(userId) {
  stateMachine.transition('LoggedIn', { userId });
}

//@TwoFactorAuth->AccountLocked:Too many failed 2FA
function twoFactorLocked(lockedUntil) {
  stateMachine.transition('AccountLocked', { lockedUntil });
}

//@LoggedIn->LoggedOut:Logout
function userLogout() {
  stateMachine.transition('LoggedOut');
}

//@LoggedIn->SessionExpired:Token expired
function tokenExpired() {
  stateMachine.transition('SessionExpired');
}

//@SessionExpired->LoggedOut:Redirect done
function redirectDone() {
  stateMachine.transition('LoggedOut');
}

//@AccountLocked->LoggedOut:Unlock timeout
function unlockTimeout() {
  stateMachine.transition('LoggedOut');
}
