-- AlterTable
ALTER TABLE "User" ADD COLUMN     "idNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_schoolId_idNumber_key" ON "User"("schoolId", "idNumber");

