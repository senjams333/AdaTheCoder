import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  findById(id: number): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  create(data: Partial<User>): Promise<User> {
    return this.users.save(this.users.create(data));
  }

  save(user: User): Promise<User> {
    return this.users.save(user);
  }

  async remove(user: User): Promise<void> {
    await this.users.remove(user);
  }
}
