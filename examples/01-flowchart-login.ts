//@::graph LR

//@Entry
class LoginController {
  //@Entry1:Handle login
  async handleLogin(email: string, password: string, ip: string) {
    //@->RateLimiter1:Check limit
    const allowed = await this.rateLimiter.check(ip);
    if (!allowed) return this.errorHandler.tooManyRequests();

    //@->Auth1:Authenticate
    const user = await this.authService.authenticate(email, password);
    if (!user) return this.errorHandler.invalidCredentials();

    if (user.twoFactorEnabled) {
      //@->TwoFactor1:Challenge 2FA
      return this.twoFactorController.initiateChallenge(user);
    }

    //@->Auth2:Create session
    const session = await this.authService.createSession(user);
    //@->Dashboard1:Show dashboard
    return this.responseHandler.sendSuccess(session);
  }

  //@Entry1.1:Verify 2FA
  async verifyTwoFactor(code: string, token: string) {
    //@->TwoFactor2:Validate code
    if (!this.twoFactorService.validateCode(token, code)) {
      return this.errorHandler.invalidTwoFactor();
    }
    //@->Auth2:Create session
    const session = await this.authService.createSession(token);
    //@->Dashboard1:Show dashboard
    return this.responseHandler.sendSuccess(session);
  }
}

//@Auth
class AuthService {
  //@Auth1:Authenticate
  async authenticate(email: string, password: string) {
    const user = await this.db.findOne({ email });
    if (!user) return null;
    const match = await this.comparePasswords(password, user.hash);
    return match ? user : null;
  }

  //@Auth2:Create session
  async createSession(userOrToken: any) {
    const token = this.generateJWT(userOrToken);
    await this.db.save({ token, userId: userOrToken.id });
    return { token };
  }
}

//@TwoFactor
class TwoFactorService {
  //@TwoFactor1:Challenge 2FA
  async initiateChallenge(user: User) {
    const code = this.generateTOTP(user.secret);
    await this.notification.sendSMS(user.phone, code);
    return { challenge: true };
  }

  //@TwoFactor2:Validate code
  validateCode(token: string, code: string) {
    return this.verifyTOTP(token, code);
  }
}

//@Dashboard
class DashboardService {
  //@Dashboard1:Show dashboard
  showDashboard(userId: string) {
    //@->Dashboard2:Load data
    this.loadData(userId);
  }

  //@Dashboard2:Load data
  async loadData(userId: string) {
    const user = await this.db.findOne({ userId });
    return this.render(user);
  }
}

//@RateLimiter
class RateLimiter {
  //@RateLimiter1:Check limit
  async check(ip: string) {
    const count = await this.redis.get(`rate:${ip}`);
    return (count || 0) < 10;
  }
}

//@Error
class ErrorHandler {
  //@Error1:Invalid credentials
  invalidCredentials() {
    return { status: 401, message: "Invalid credentials" };
  }

  //@Error2:Too many requests
  tooManyRequests() {
    return { status: 429, message: "Too many requests" };
  }

  //@Error3:Invalid 2FA
  invalidTwoFactor() {
    return { status: 401, message: "Invalid 2FA code" };
  }
}
