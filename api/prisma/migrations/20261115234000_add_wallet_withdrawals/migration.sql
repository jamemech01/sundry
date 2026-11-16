ALTER TYPE "WalletTransactionType" ADD VALUE 'withdrawal';

CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'completed', 'rejected');

ALTER TABLE "Transaction"
ADD COLUMN "status" "TransactionStatus" NOT NULL DEFAULT 'completed';
