import * as dotenv from 'dotenv';
dotenv.config();

export const localMongoUri = process.env.LOCAL_MONGO_URI || '';
export const cloudMongoUri = process.env.CLOUD_MONGO_URI || '';

export const mongooseConnectionString = localMongoUri;
