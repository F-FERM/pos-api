import { BadRequestException, NotFoundException } from '@nestjs/common';
import mongoose, {
  HydratedDocument,
  Model,
  PopulateOptions,
  ClientSession,
} from 'mongoose';
import { normalizePopulate } from './genericHelper';

type DbOptions = {
  session?: ClientSession;
};

export class GenericDatabase<T extends Model<HydratedDocument<any>>> {
  constructor(private readonly dbModel: T) {}

  protected isValidMongoId = (id: string) => {
    return mongoose.isValidObjectId(id);
  };

  /**
   * Executes a series of database operations within a transaction.
   *
   * This function ensures that all operations within the `operation` callback are
   * executed atomically. If any operation fails, the entire transaction is rolled back.
   *
   * @template R - The return type of the operation.
   * @param {(session: ClientSession) => Promise<R>} operation - A function that takes a Mongoose session and returns a Promise resolving to the result of the transaction.
   * @returns {Promise<R>} - A Promise that resolves with the result of the `operation` function if the transaction is successful.
   * @throws {Error} - Throws any error that occurs during the transaction, and the transaction is aborted.
   */
  async runTransaction<R>(
    operation: (session: ClientSession) => Promise<R>,
  ): Promise<R> {
    const session = await this.dbModel.db.startSession();

    try {
      session.startTransaction();

      const result = await operation(session);

      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /** * Finds a document by its username.
   *
   * This function queries the database for a document matching the provided username.
   *
   * @param {string} username - The username of the document to find.
   * @returns {Promise<HydratedDocument<any> | null>} - A Promise that resolves to the document if found, or null otherwise.
   * @throws {NotFoundException} - Thrown if an error occurs during the search.
   */
  async genericFindByUsername(
    username: string,
    populateFields?: string[],
  ): Promise<HydratedDocument<any> | null> {
    try {
      let query = this.dbModel.findOne({ username, isDeleted: false });

      if (populateFields && populateFields.length > 0) {
        query = query.populate(populateFields);
      }

      const response = await query.exec();

      if (!response) {
        throw new NotFoundException(
          `Document with username ${username} not found`,
        );
      }

      return response;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error finding document by username:', error);
        throw new NotFoundException(
          `Error finding document by username: ${error.message}`,
        );
      }

      console.error('Unknown error finding document by username:', error);
      throw error;
    }
  }

  /** * Generic method to find all documents.
   * * This function retrieves all documents from the database.
   *
   * @returns {Promise<HydratedDocument<any>[]>} - A Promise that resolves to an array of all documents.
   * @throws {NotFoundException} - Thrown if an error occurs during the retrieval.
   */
  async genericFindAll(filter?: any): Promise<HydratedDocument<any>[]> {
    try {
      const response: HydratedDocument<any>[] = await this.dbModel
        .find({ ...filter, isDeleted: false })
        .exec();

      if (!response) {
        throw new NotFoundException(
          `No ${this.dbModel.modelName} documents found`,
        );
      }

      return response;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error finding all documents:', error);
        throw new NotFoundException(
          `Error finding all documents: ${error.message}`,
        );
      }
      console.log('Unknown error finding all documents:', error);
      throw error;
    }
  }

  /**
   * Finds a single document by its ID where `isDeleted` is false.
   *
   * @param {string} id - The unique identifier of the document to find.
   * @returns {Promise<HydratedDocument<any> | null>} The found document, or throws an error if not found.
   * @throws {Error} When the document is not found or a database error occurs.
   */
  async genericFindOneByIdOrNotFound(
    id: string,
    populateFields?: string[],
  ): Promise<HydratedDocument<any> | null> {
    try {
      let query = this.dbModel.findOne({ _id: id, isDeleted: false });

      if (populateFields && populateFields.length > 0) {
        query = query.populate(populateFields);
      }

      const response: HydratedDocument<any> | null = await query.exec();

      if (!response) {
        throw new NotFoundException(
          `${this.dbModel.modelName} Document not found`,
        );
      }

      return response;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error finding document:', error);
        throw new BadRequestException(
          `Error finding document: ${error.message}`,
        );
      }

      console.log('Unknown error finding document by id:', error);
      throw BadRequestException;
    }
  }

  /** * Generic method to create a new document.
   *
   * This function creates a new document in the database using the provided DTO.
   *
   * @param {any} createDto - The data transfer object containing the data for the new document.
   * @returns {Promise<HydratedDocument<any>>} - A Promise that resolves to the created document.
   * @throws {BadRequestException} - Thrown if an error occurs during creation.
   */
  async genericCreateOne(
    createDto: any,
    options?: DbOptions,
  ): Promise<HydratedDocument<any>> {
    try {
      const createdDocument = new this.dbModel(createDto);

      const response = await createdDocument.save({
        session: options?.session,
      });

      if (!response) {
        throw new BadRequestException(
          `Failed to create ${this.dbModel.modelName} document`,
        );
      }

      return response;
    } catch (error: unknown) {
      console.error('Error creating document:', error);
      if (error instanceof Error) {
        throw new BadRequestException(
          `Error creating document: ${error.message}`,
        );
      }
      console.log('Unknown error creating document:', error);
      throw error;
    }
  }

  /** * Generic method to update a document by its ID.
   *
   * This function updates an existing document in the database using the provided update DTO.
   *
   * @param {string} id - The unique identifier of the document to update.
   * @param {any} updateDto - The data transfer object containing the updated data for the document.
   * @returns {Promise<HydratedDocument<any> | null>} - A Promise that resolves to the updated document, or null if not found.
   * @throws {NotFoundException} - Thrown if the document with the specified ID is not found.
   * @throws {BadRequestException} - Thrown if an error occurs during the update.
   */
  async genericUpdateOne(
    id: string,
    updateDto: any,
    options?: DbOptions,
  ): Promise<HydratedDocument<any> | null> {
    try {
      const updatedDocument = await this.dbModel
        .findOneAndUpdate({ _id: id, isDeleted: false }, updateDto, {
          new: true,
          session: options?.session,
        })
        .exec();

      if (!updatedDocument) {
        throw new NotFoundException(
          `${this.dbModel.modelName} Document with id ${id} not found`,
        );
      }

      return updatedDocument;
    } catch (error: unknown) {
      console.error('Error updating document:', error);
      if (error instanceof Error) {
        throw new BadRequestException(
          `Error updating document: ${error.message}`,
        );
      }
      console.log('Unknown error updating document:', error);
      throw error;
    }
  }

  /** * Generic method to "delete" a document by its ID.
   *
   * This function marks a document as deleted in the database by setting its `isDeleted` flag to true.
   *
   * @param {string} id - The unique identifier of the document to delete.
   * @returns {Promise<HydratedDocument<any> | null>} - A Promise that resolves to the deleted document, or null if not found.
   * @throws {NotFoundException} - Thrown if the document with the specified ID is not found.
   * @throws {BadRequestException} - Thrown if an error occurs during the deletion.
   */
  async genericDeleteOne(
    id: string,
    options?: DbOptions,
  ): Promise<HydratedDocument<any> | null> {
    try {
      const deletedDocument = await this.dbModel
        .findOneAndUpdate(
          { _id: id, isDeleted: false },
          { isDeleted: true },
          {
            new: true,
            session: options?.session,
          },
        )
        .exec();

      if (!deletedDocument) {
        throw new NotFoundException(
          `${this.dbModel.modelName} Document not found`,
        );
      }

      return deletedDocument;
    } catch (error: unknown) {
      console.error('Error deleting document:', error);
      if (error instanceof Error) {
        throw new BadRequestException(
          `Error deleting document: ${error.message}`,
        );
      }
      console.log('Unknown error deleting document:', error);
      throw error;
    }
  }

  /** * Generic method to find a single document by a filter.
   *
   * This function retrieves a single document from the database that matches the provided filter.
   *
   * @param {any} filter - The filter criteria to find the document.
   * @returns {Promise<HydratedDocument<any> | null>} - A Promise that resolves to the found document, or null if not found.
   * @throws {NotFoundException} - Thrown if an error occurs during the search.
   */
  async genericFindOne(
    filter: any,
    options?: DbOptions,
  ): Promise<HydratedDocument<any> | null> {
    try {
      const response: HydratedDocument<any> | null = await this.dbModel
        .findOne({ ...filter, isDeleted: false }, null, {
          session: options?.session,
        })
        .exec();

      return response;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error finding document by filter:', error);
        throw new NotFoundException(
          `Error finding document by filter: ${error.message}`,
        );
      }
      console.log('Unknown error finding document by filter:', error);
      throw error;
    }
  }

  /**
   * Find a single document with optional population.
   *
   * @template T - The type of the document
   * @param filter - Filter criteria for finding the document
   * @param populateOptions - Optional populate fields (string, PopulateOptions, or array)
   * @returns The found document with populated fields, or null if not found
   * @throws NotFoundException if there is an error during the query
   */
  async genericFindOneWithPopulate<T>(
    filter: any,
    populateOptions?: string | PopulateOptions | (string | PopulateOptions)[],
  ): Promise<HydratedDocument<T> | null> {
    try {
      let query = this.dbModel.findOne({ ...filter, isDeleted: false });

      const normalizedPopulate = normalizePopulate(populateOptions);
      if (normalizedPopulate) {
        query = query.populate(normalizedPopulate);
      }

      return await query.exec();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error finding and populating document:', error);
        throw new NotFoundException(
          `Error finding and populating document: ${error.message}`,
        );
      }
      throw error;
    }
  }
  /**
   * Find all documents matching a filter with optional population.
   *
   * @template T - The type of the documents
   * @param filter - Filter criteria for finding documents
   * @param populateOptions - Optional populate fields (string, PopulateOptions, or array)
   * @returns Array of found documents with populated fields (empty array if none found)
   * @throws NotFoundException if there is an error during the query
   */
  async genericFindAllWithPopulate<T>(
    filter?: any,
    populateOptions?: string | PopulateOptions | (string | PopulateOptions)[],
  ): Promise<HydratedDocument<T>[]> {
    try {
      let query = this.dbModel.find({ ...filter, isDeleted: false });

      const normalizedPopulate = normalizePopulate(populateOptions);
      if (normalizedPopulate) {
        query = query.populate(normalizedPopulate);
      }

      return await query.exec();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error finding and populating documents:', error);
        throw new NotFoundException(
          `Error finding and populating documents: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Generic method to find a single document by a filter or throw NotFoundException.
   *
   * This function retrieves a single document from the database that matches the provided filter.
   * If no document is found, it throws a NotFoundException.
   *
   * @param {any} filter - The filter criteria to find the document.
   * @returns {Promise<HydratedDocument<any> | null>} - A Promise that resolves to the found document.
   * @throws {NotFoundException} - Thrown if no document is found or an error occurs during the search.
   */
  async genericFindOneOrNotFound(
    filter: any,
  ): Promise<HydratedDocument<any> | null> {
    try {
      const response: HydratedDocument<any> | null = await this.dbModel
        .findOne({ ...filter, isDeleted: false })
        .exec();

      if (!response) {
        throw new NotFoundException(
          `${this.dbModel.modelName} Document not found with provided filter`,
        );
      }
      return response;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error finding document by filter:', error);
        throw new NotFoundException(
          `Error finding document by filter: ${error.message}`,
        );
      }
      console.log('Unknown error finding document by filter:', error);
      throw error;
    }
  }

  validateIdsExist = async (
    model: any,
    ids: Array<string | null | undefined>,
    fieldName: string,
  ) => {
    try {
      const validIds: string[] = ids
        .filter((id): id is string => !!id)
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      if (!validIds.length) return;

      const invalidIds: string[] = validIds.filter(
        (id) => !this.isValidMongoId(id),
      );

      if (invalidIds.length) {
        throw new BadRequestException(
          `Invalid ${fieldName}: [${invalidIds.join(', ')}]`,
        );
      }

      const uniqueIds: string[] = [...new Set(validIds)];

      const existingDocs = await model
        .find(
          {
            _id: { $in: uniqueIds },
            isDeleted: false,
          },
          { _id: 1 },
        )
        .lean();

      const existingIds = existingDocs.map((doc) => doc._id.toString());

      const missingIds: string[] = uniqueIds.filter(
        (id) => !existingIds.includes(id),
      );

      if (missingIds.length) {
        throw new BadRequestException(`Invalid ${fieldName}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Validation error (${fieldName}):`, error.message);
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException(`Error validating ${fieldName}`);
    }
  };

  async validateItemReferenceFields(
    items: any[],
    validations: {
      model: any;
      field: string;
      label: string;
    }[],
  ) {
    if (!items || !items.length) return;

    for (const v of validations) {
      await this.validateIdsExist(
        v.model,
        items.map((i) => i[v.field]),
        v.label,
      );
    }
  }

  async getClientIpAddress(req: any): Promise<string> {
    let ip =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'UNKNOWN';

    // Convert IPv6 localhost to IPv4
    if (ip === '::1') {
      ip = '127.0.0.1';
    }

    return ip;
  }
}
