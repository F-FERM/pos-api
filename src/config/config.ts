import * as dotenv from 'dotenv';
dotenv.config();

export const localMongoUri = process.env.LOCAL_MONGO_URI || '';
export const cloudMongoUri = process.env.CLOUD_MONGO_URI || '';

// Single Master Switch Variable: Set IS_CLOUD_ONLY=true in .env during development to read/write all data directly to Cloud MongoDB
export const isCloudOnly = process.env.IS_CLOUD_ONLY === 'true';

export const activeMongoUri = isCloudOnly ? cloudMongoUri : localMongoUri;
export const mongooseConnectionString = activeMongoUri;
