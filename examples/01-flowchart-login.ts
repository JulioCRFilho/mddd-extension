//@::graph LR

//@Entry
class LoginController {
  //@Entry1:Handle login request
  async handleLoginRequest(email: string, password: string, ip: string) {
    //@->RateLimiter1:Check rate limit
    const rateCheck = await this.rateLimiter.check(ip);
    if (!rateCheck.allowed) {
      //@->Error5:Rate limit exceeded
      return this.errorHandler.tooManyRequests(ip);
    }

    //@->Auth6:Lookup account
    const account = await this.authService.findAccount(email);
    if (account?.lockedUntil && account.lockedUntil > Date.now()) {
      //@->Error3:Account locked
      return this.errorHandler.accountLocked(email);
    }

    //@->Auth1:Authenticate user
    const result = await this.authService.authenticate(email, password);
    if (!result.success) {
      //@->RateLimiter2:Increment failures
      await this.rateLimiter.increment(ip);
      //@->Auth2:Record failed attempt
      await this.authService.recordFailedAttempt(email);
      //@->Error2:Invalid credentials
      return this.errorHandler.invalidCredentials(email);
    }

    if (account.twoFactorEnabled) {
      //@->TwoFactor1:Initiate 2FA challenge
      return this.twoFactorController.initiateChallenge(account);
    }

    //@->Auth3:Create session
    const session = await this.authService.createSession(account);
    //@->Dashboard1:Redirect to dashboard
    return this.responseHandler.sendSuccess(session);
  }

  //@Entry1.1:Verify 2FA code
  async verifyTwoFactor(accountId: string, code: string) {
    //@->TwoFactor2:Validate TOTP code
    const valid = await this.twoFactorService.validateCode(accountId, code);
    if (!valid) {
      //@->Auth5:Record failed 2FA
      await this.authService.recordFailed2FA(accountId);
      //@->Error4:Invalid 2FA code
      return this.errorHandler.invalidTwoFactor(accountId);
    }
    //@->Auth7:Lookup account by ID
    const account = await this.authService.findAccountById(accountId);
    //@->Auth3:Create session
    const session = await this.authService.createSession(account);
    //@->Dashboard1:Redirect to dashboard
    return this.responseHandler.sendSuccess(session);
  }
}

//@Auth
class AuthService {
  //@Auth1:Authenticate credentials
  async authenticate(email: string, password: string) {
    //@Auth1.1:Find user in DB
    const user = await this.findUser(email);
    if (!user) {
      return { success: false };
    }
    //@Auth1.2:Compare password hash
    const valid = await this.comparePasswords(password, user.hash);
    return { success: valid, user };
  }

  //@Auth2:Record failed attempt
  async recordFailedAttempt(email: string) {
    //@Auth2.1:Increment attempt counter
    const attempts = await this.incrementAttempts(email);
    if (attempts >= 5) {
      //@Auth2.2:Lock account for 30 min
      await this.lockAccount(email, 30 * 60 * 1000);
    }
  }

  //@Auth3:Create session
  async createSession(account: Account) {
    //@Auth3.1:Generate JWT
    const token = this.generateJWT(account);
    //@Auth3.2:Generate refresh token
    const refreshToken = this.generateRefreshToken();
    //@Auth3.3:Persist session
    await this.saveSession(token, refreshToken, account);
    return { accessToken: token, refreshToken, expiresIn: 3600 };
  }

  //@Auth4:Lock account
  async lockAccount(email: string, duration: number) {
    await this.db.update({ email }, { lockedUntil: Date.now() + duration });
  }

  //@Auth5:Record failed 2FA
  async recordFailed2FA(accountId: string) {
    const attempts = await this.increment2FAAttempts(accountId);
    if (attempts >= 3) {
      await this.lockAccountById(accountId, 30 * 60 * 1000);
    }
  }

  //@Auth6:Find account by email
  async findAccount(email: string) {
    return await this.db.findOne({ email });
  }

  //@Auth7:Find account by ID
  async findAccountById(accountId: string) {
    return await this.db.findById(accountId);
  }

  //@Auth8:Invalidate all sessions
  async invalidateAllSessions(accountId: string) {
    await this.db.deleteMany({ accountId });
  }
}

//@TwoFactor
class TwoFactorService {
  //@TwoFactor1:Initiate 2FA challenge
  async initiateChallenge(account: Account) {
    //@TwoFactor1.1:Generate TOTP
    const code = this.generateTOTP(account.twoFactorSecret);
    //@TwoFactor1.2:Send SMS
    await this.notificationService.sendSMS(account.phone, "Your code: " + code);
    return { requiresTwoFactor: true, expiresIn: 300 };
  }

  //@TwoFactor2:Validate TOTP code
  async validateCode(accountId: string, code: string) {
    //@TwoFactor2.1:Find account
    const account = await this.findAccountById(accountId);
    //@TwoFactor2.2:Verify TOTP
    return this.verifyTOTP(account.twoFactorSecret, code);

//@ForgotPassword
class PasswordResetService {
  //@ForgotPassword1:Request password reset
  async requestReset(email: string) {
    //@ForgotPassword1.1:Find account
    const account = await this.findAccount(email);
    if (!account) {
      return { message: "If the email exists, a reset link has been sent" };
    }
    //@ForgotPassword1.2:Generate reset token
    const token = this.generateResetToken();
    //@ForgotPassword1.3:Store reset token
    await this.storeResetToken(account.id, token);
    //@ForgotPassword1.4:Send reset email
    await this.notificationService.sendResetEmail(email, token);
    return { message: "If the email exists, a reset link has been sent" };
  }

  //@ForgotPassword2:Confirm password reset
  async confirmReset(token: string, newPassword: string) {
    //@ForgotPassword2.1:Validate reset token
    const accountId = await this.validateResetToken(token);
    if (!accountId) {
      return { error: "Invalid or expired reset token" };
    }
    //@ForgotPassword2.2:Hash new password
    const hashedPassword = await this.hashPassword(newPassword);
    //@ForgotPassword2.3:Update password
    await this.updatePassword(accountId, hashedPassword);
    //@ForgotPassword2.4:Invalidate reset token
    await this.invalidateResetToken(token);
    //@->Auth8:Invalidate all sessions
    await this.authService.invalidateAllSessions(accountId);
    return { success: true };
  }
}

//@Dashboard
class DashboardService {
  //@Dashboard1:Show dashboard
  showDashboard(userId: string) {
    //@Dashboard1.1:Load user data
    //@->Dashboard2:Fetch user profile
    this.loadUserData(userId);
    //@Dashboard1.2:Load notifications
    //@->Dashboard3:Fetch notifications
    this.loadNotifications(userId);
    //@Dashboard1.3:Render UI
    this.renderUI();
  }

  //@Dashboard2:Load user data
  loadUserData(userId: string) {
    console.log("Loading data for user " + userId + "...");
  }

  //@Dashboard3:Load notifications
  loadNotifications(userId: string) {
    console.log("Loading notifications for " + userId + "...");
  }
}

//@Error
class ErrorHandler {
  //@Error1:Handle error
  handleError(error: Error) {
    //@Error1.1:Log error
    this.logError(error);
    //@Error1.2:Show error message
    this.showErrorMessage(error.message);
  }

  //@Error2:Invalid credentials response
  invalidCredentials(email: string) {
    return { status: 401, message: "Invalid email or password" };
  }

  //@Error3:Account locked response
  accountLocked(email: string) {
    return { status: 423, message: "Account temporarily locked" };
  }

  //@Error4:Invalid 2FA response
  invalidTwoFactor(accountId: string) {
    return { status: 401, message: "Invalid 2FA code" };
  }

  //@Error5:Rate limit response
  tooManyRequests(ip: string) {
    return { status: 429, message: "Too many requests. Try again later." };
  }
}

//@RateLimiter
class RateLimiter {
  //@RateLimiter1:Check rate limit
  async check(ip: string) {
    //@RateLimiter1.1:Query Redis
    const count = await this.redis.get("rate:" + ip);
    return { allowed: (count || 0) < 10 };
  }

  //@RateLimiter2:Increment counter
  async increment(ip: string) {
    //@RateLimiter2.1:Increment Redis
    await this.redis.incr("rate:" + ip);
    //@RateLimiter2.2:Set TTL
    await this.redis.expire("rate:" + ip, 60);
  }
}

  }
}
