import { Injectable } from '@angular/core';
import { UserApplicationService } from '../enactment/user-application.service';
import { UserRepository, UserDomainService } from '../domain/user.repository';
import { InMemoryUserRepository } from '../infrastructure/in-memory-user.repository';

// Integration layer - Dependency Injection configuration
@Injectable({
  providedIn: 'root'
})
export class UserServiceFactory {
  private static userApplicationService: UserApplicationService | null = null;

  static createUserApplicationService(): UserApplicationService {
    if (!this.userApplicationService) {
      const userRepository: UserRepository = new InMemoryUserRepository();
      const userDomainService = new UserDomainService(userRepository);
      this.userApplicationService = new UserApplicationService(userRepository, userDomainService);
    }
    return this.userApplicationService;
  }
}

// Angular service wrapper for the application service
@Injectable({
  providedIn: 'root'
})
export class AngularUserService {
  private readonly userApplicationService: UserApplicationService;

  constructor() {
    this.userApplicationService = UserServiceFactory.createUserApplicationService();
  }

  // Delegate all methods to the application service
  async createUser(name: string, email: string) {
    return this.userApplicationService.createUser(name, email);
  }

  async getAllUsers() {
    return this.userApplicationService.getAllUsers();
  }

  async getUserById(id: string) {
    return this.userApplicationService.getUserById(id);
  }

  async deleteUser(id: string) {
    return this.userApplicationService.deleteUser(id);
  }
}
