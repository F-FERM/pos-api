import * as dotenv from 'dotenv';
dotenv.config();
export const mongooseConnectionString = process.env.MONGO_URI || '';
