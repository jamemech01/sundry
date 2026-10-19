import type { Config } from 'jest';
import { config as loadEnv } from 'dotenv';

const env = loadEnv({
    path: '.env.test',
    override: true,
});

if (env.error) {
    throw env.error;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing from .env.test');
}

const databaseName = new URL(databaseUrl).pathname.slice(1);

if (databaseName !== 'sundry_test') {
    throw new Error(
        `Integration tests must use sundry_test, not ${databaseName} `,
    );
}

const jestConfig: Config = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testRegex: '.*\\.integration-spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': [
            'ts-jest',
            {
                tsconfig: {
                    rootDir: '.',
                },
            },
        ],
    },
    testEnvironment: 'node',
    maxWorkers: 1,
};

export default jestConfig;
