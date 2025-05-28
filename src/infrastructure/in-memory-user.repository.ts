import { Injectable } from '@angular/core';
import { User, UserId } from '../domain/user.entity';
import { UserRepository } from '../domain/user.repository';
import { Logger } from '../common/utils';

// Infrastructure implementation of the Domain repository contract
@Injectable({
  providedIn: 'root'
})
export class InMemoryUserRepository extends UserRepository {
  private users: User[] = [
    {
      id: 'user_sample1_1732805900000',
      name: 'John Doe',
      email: 'john.doe@example.com',
      createdAt: new Date('2024-01-15'),
      isActive: true
    },
    {
      id: 'user_sample2_1732805900001',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      createdAt: new Date('2024-02-20'),
      isActive: true
    },
    {
      id: 'user_sample3_1732805900002',
      name: 'Bob Wilson',
      email: 'bob.wilson@example.com',
      createdAt: new Date('2024-03-10'),
      isActive: false
    }
  ];

  async findById(id: UserId): Promise<User | null> {
    Logger.info('Searching for user by ID', { id: id.getValue() });
    const user = this.users.find(u => u.id === id.getValue()) || null;
    Logger.info('User search result', { found: !!user });
    return Promise.resolve(user);
  }

  async findAll(): Promise<User[]> {
    Logger.info('Fetching all users from in-memory store', { count: this.users.length });
    return Promise.resolve([...this.users]);
  }

  async save(user: User): Promise<void> {
    Logger.info('Saving user to in-memory store', { userId: user.id });
    
    const existingIndex = this.users.findIndex(u => u.id === user.id);
    if (existingIndex >= 0) {
      this.users[existingIndex] = user;
      Logger.info('User updated in store');
    } else {
      this.users.push(user);
      Logger.info('User added to store');
    }
    
    return Promise.resolve();
  }

  async delete(id: UserId): Promise<void> {
    Logger.info('Deleting user from in-memory store', { id: id.getValue() });
    
    const initialLength = this.users.length;
    this.users = this.users.filter(u => u.id !== id.getValue());
    
    if (this.users.length < initialLength) {
      Logger.info('User deleted from store');
    } else {
      Logger.warn('User not found for deletion', { id: id.getValue() });
    }
    
    return Promise.resolve();
  }
}
