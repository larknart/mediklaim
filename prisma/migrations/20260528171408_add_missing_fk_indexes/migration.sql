-- CreateIndex
CREATE INDEX "AnnualAllocation_userId_idx" ON "AnnualAllocation"("userId");

-- CreateIndex
CREATE INDEX "Approval_actorId_idx" ON "Approval"("actorId");

-- CreateIndex
CREATE INDEX "ClaimComment_authorId_idx" ON "ClaimComment"("authorId");

-- CreateIndex
CREATE INDEX "Department_headId_idx" ON "Department"("headId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");
