import { Injectable, NotFoundException } from '@nestjs/common';
import {
  User,
  UserDocument,
  UserModelConstants,
  UserSchemaName,
} from '../models/user.schema';
import { GenericDatabase } from '../helper/genericDatabase';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService extends GenericDatabase<Model<UserDocument>> {
  constructor(
    @InjectModel(UserSchemaName)
    private readonly userModel: Model<UserDocument>,
  ) {
    super(userModel);
  }

  /**
   * Validate user credentials.
   * @param username - The username of the user.
   * @param pass - The password of the user.
   * @returns The user document if valid, otherwise null.
   */
  async validateUser(username: string, pass: string): Promise<User | null> {
    try {
      const user = await this.genericFindByUsername(username, [
        `${UserModelConstants.privilegeId}`,
      ]);
      if (user && (await bcrypt.compare(pass, user.password))) {
        return user;
      }
      return null;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error validating user:', error);
        throw new NotFoundException(error.message);
      }
      console.error('Unknown error validating user:', error);
      throw error;
    }
  }
}
