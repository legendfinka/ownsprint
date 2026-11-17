-- The single "name" becomes the first name; the last name starts empty.
ALTER TABLE "User" RENAME COLUMN "name" TO "firstName";
ALTER TABLE "User" ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "avatarColor" TEXT,
ADD COLUMN     "avatarEmoji" TEXT;
