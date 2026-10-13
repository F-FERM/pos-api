import * as dotenv from 'dotenv';
dotenv.config();

export const localMongoUri = process.env.LOCAL_MONGO_URI || '';
export const cloudMongoUri = process.env.CLOUD_MONGO_URI || '';

// Master Switch 1: Set IS_CLOUD_ONLY=true in .env during development to read/write all data directly to Cloud MongoDB
export const isCloudOnly = process.env.IS_CLOUD_ONLY === 'true';

// Master Switch 2: Set SYNC_MINIMAL=true in .env for production mode to sync strictly administrative data (Company, User, License, Subscription, Device, EmailOtp)
export const isSyncMinimal = process.env.SYNC_MINIMAL === 'true';

export const activeMongoUri = isCloudOnly ? cloudMongoUri : localMongoUri;
export const mongooseConnectionString = activeMongoUri;
