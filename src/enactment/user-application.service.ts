import { User, UserId, Email } from '../domain/user.entity';
import { UserRepository, UserDomainService } from '../domain/user.repository';
import { Result } from '../common/result';
import { Logger } from '../common/utils';

// Application Service for User operations
export class UserApplicationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userDomainService: UserDomainService
  ) {}

  async createUser(name: string, email: string): Promise<Result<User, string>> {
    try {
      Logger.info('Creating user', { name, email });

      // Validate input using domain service
      this.userDomainService.validateUserForCreation(name, email);

      // Validate email format using value object
      const emailVO = new Email(email);

      // Check if email is unique
      const isEmailUnique = await this.userDomainService.isEmailUnique(email);
      if (!isEmailUnique) {
        return Result.failure('Email already exists');
      }

      // Create user entity
      const user: User = {
        id: this.generateId(),
        name: name.trim(),
        email: emailVO.getValue(),
        createdAt: new Date(),
        isActive: true
      };

      // Save user
      await this.userRepository.save(user);

      Logger.info('User created successfully', { userId: user.id });
      return Result.success(user);

    } catch (error) {
      Logger.error('Failed to create user', error as Error, { name, email });
      return Result.failure(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async getAllUsers(): Promise<Result<User[], string>> {
    try {
      Logger.info('Fetching all users');
      const users = await this.userRepository.findAll();
      return Result.success(users);
    } catch (error) {
      Logger.error('Failed to fetch users', error as Error);
      return Result.failure(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async getUserById(id: string): Promise<Result<User, string>> {
    try {
      Logger.info('Fetching user by ID', { id });
      const userId = new UserId(id);
      const user = await this.userRepository.findById(userId);
      
      if (!user) {
        return Result.failure('User not found');
      }

      return Result.success(user);
    } catch (error) {
      Logger.error('Failed to fetch user', error as Error, { id });
      return Result.failure(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async deleteUser(id: string): Promise<Result<void, string>> {
    try {
      Logger.info('Deleting user', { id });
      const userId = new UserId(id);
      
      // Check if user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return Result.failure('User not found');
      }

      await this.userRepository.delete(userId);
      Logger.info('User deleted successfully', { id });
      return Result.success(undefined);
    } catch (error) {
      Logger.error('Failed to delete user', error as Error, { id });
      return Result.failure(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private generateId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
}
