import { config } from 'dotenv'

// Load environment variables from .env file before tests run
config()

process.env.NODE_ENV = 'test'
