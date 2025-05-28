import { User, UserId } from './user.entity';

// Domain Repository Contract (Interface)
export abstract class UserRepository {
  abstract findById(id: UserId): Promise<User | null>;
  abstract findAll(): Promise<User[]>;
  abstract save(user: User): Promise<void>;
  abstract delete(id: UserId): Promise<void>;
}

// Domain Service
export class UserDomainService {
  constructor(private userRepository: UserRepository) {}

  async isEmailUnique(email: string, excludeUserId?: UserId): Promise<boolean> {
    const users = await this.userRepository.findAll();
    return !users.some(user => 
      user.email === email && 
      (!excludeUserId || user.id !== excludeUserId.getValue())
    );
  }

  validateUserForCreation(name: string, email: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('User name is required');
    }
    if (name.length < 2) {
      throw new Error('User name must be at least 2 characters long');
    }
    if (name.length > 100) {
      throw new Error('User name cannot exceed 100 characters');
    }
  }
}
