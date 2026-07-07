// Load environment variables from .env file before tests run
import { config } from 'dotenv'

// Set NODE_ENV first so .env can't override test environment
process.env.NODE_ENV = 'test'
// Silence dotenvx output
process.env.DOTENV_CONFIG_QUIET = 'true'
config()

// Ensure LOG_LEVEL is not set in test environment (should use NODE_ENV-based default)
delete process.env.LOG_LEVEL
