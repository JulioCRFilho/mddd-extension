//@::sequenceDiagram

//@Client
class ApiClient {
  //@Client1:Enviar request com JWT
  async fetchUserData(userId) {
    const token = await this.authStore.getToken();
    const response = await fetch('/api/users/' + userId, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (response.status === 401) {
      return this.handleUnauthorized();
    }
    return response.json();
  }

  //@Client1.1:Tratar 401
  async handleUnauthorized() {
    const newToken = await this.refreshAccessToken();
    if (newToken) {
      return this.retryLastRequest();
    }
    this.redirectToLogin();
  }
}

//@Gateway
class ApiGateway {
  //@Gateway1:Rate limit check
  async handleRequest(req, res) {
    const clientIp = req.ip;
    const allowed = await this.rateLimiter.check(clientIp);
    if (!allowed) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    this.proxyToService(req, res);
  }
}

//@AuthMiddleware
class AuthMiddleware {
  //@AuthMiddleware1:Validar token JWT
  async validateToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }
    const token = header.split(' ')[1];
    try {
      const decoded = await this.jwtService.verify(token);
      req.userId = decoded.sub;
      req.roles = decoded.roles;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  //@AuthMiddleware1.1:Verificar permissoes RBAC
  async checkPermission(req, res, next) {
    const requiredRole = req.route?.requiredRole;
    if (requiredRole && !req.roles.includes(requiredRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  }
}

//@Cache
class CacheService {
  //@Cache1:Consultar cache
  async getCachedUser(userId) {
    const cached = await this.redis.get('user:' + userId);
    if (cached) {
      console.log('Cache hit');
      return JSON.parse(cached);
    }
    console.log('Cache miss');
    return null;
  }

  //@Cache1.1:Armazenar no cache
  async setCachedUser(userId, userData) {
    await this.redis.set('user:' + userId, JSON.stringify(userData), 'EX', 300);
  }
}

//@Server
class UserService {
  //@Server1:Buscar usuario (com cache)
  async getUserById(userId) {
    const cached = await this.cacheService.getCachedUser(userId);
    if (cached) return cached;
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    await this.cacheService.setCachedUser(userId, user);
    return user;
  }

  //@Server1.1:Atualizar usuario
  async updateUser(userId, data) {
    const validated = await this.validator.validateUserUpdate(data);
    const updated = await this.userRepository.update(userId, validated);
    await this.cacheService.invalidate('user:' + userId);
    await this.auditLog.record('USER_UPDATE', userId, data);
    return updated;
  }
}

//@Database
class UserRepository {
  //@Database1:Query com join
  async findById(userId) {
    const rows = await this.db.query(
      'SELECT u.*, a.street, a.city, a.country FROM users u LEFT JOIN addresses a ON u.default_address_id = a.id WHERE u.id = ? AND u.deleted_at IS NULL',
      [userId]
    );
    return rows[0] || null;
  }

  //@Database1.1:Atualizar com transacao
  async update(userId, data) {
    const trx = await this.db.beginTransaction();
    try {
      await trx.query('UPDATE users SET ? WHERE id = ?', [data, userId]);
      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }
}

//@Notification
class NotificationService {
  //@Notification1:Enviar email de boas-vindas
  async sendWelcomeEmail(user) {
    const template = await this.emailTemplates.get('welcome');
    const body = template.render({ name: user.name });
    await this.emailProvider.send(user.email, 'Welcome!', body);
  }

  //@Notification1.1:Enviar notificacao push
  async sendPushNotification(userId, title, message) {
    const devices = await this.deviceRepository.getDevices(userId);
    await this.pushProvider.send(devices, { title, message });
  }
}

//@AuditLog
class AuditLogService {
  //@AuditLog1:Registrar acao
  async record(action, userId, metadata) {
    await this.db.insert('audit_logs', {
      action,
      user_id: userId,
      metadata: JSON.stringify(metadata),
      ip_address: this.requestContext.ip,
      created_at: new Date(),
    });
  }
}

//@Error
class ErrorHandler {
  //@Error1:Tratar erros da API
  handleError(error, req, res) {
    const status = error.status || 500;
    const message = status === 500 ? 'Internal server error' : error.message;
    if (status === 500) {
      this.logger.error('Unhandled error', { error, requestId: req.id });
    }
    res.status(status).json({ error: message, requestId: req.id });
  }
}

// Conexoes
//@Client->Gateway:HTTP Request + JWT
//@Gateway->AuthMiddleware:Validate token
//@AuthMiddleware->Server:Forward request
//@Server->Cache:Check cache
//@Cache->Server:Cache hit/miss
//@Server->Database:SQL Query (with JOIN)
//@Database->Server:User data
//@Server->Cache:Store in cache
//@Server->Gateway:User response
//@Gateway->Client:JSON Response
//@Client->AuthMiddleware:Token expired (401)
//@Server->AuditLog:Record action
//@Server->Notification:Send welcome email
//@Notification->Client:Push notification
//@Client->Error:Error occurs
