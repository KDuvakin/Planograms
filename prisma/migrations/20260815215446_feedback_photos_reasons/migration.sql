/*
  Warnings:

  - You are about to drop the column `photoUrl` on the `Feedback` table. All the data in the column will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Feedback] DROP COLUMN [photoUrl];
ALTER TABLE [dbo].[Feedback] ADD [doesntFitByHeight] BIT NOT NULL CONSTRAINT [Feedback_doesntFitByHeight_df] DEFAULT 0,
[doesntFitFacesQty] BIT NOT NULL CONSTRAINT [Feedback_doesntFitFacesQty_df] DEFAULT 0,
[isShelfReady] BIT,
[needSeparator] BIT NOT NULL CONSTRAINT [Feedback_needSeparator_df] DEFAULT 0,
[otherReason] BIT NOT NULL CONSTRAINT [Feedback_otherReason_df] DEFAULT 0;

-- CreateTable
CREATE TABLE [dbo].[FeedbackPhoto] (
    [id] NVARCHAR(1000) NOT NULL,
    [feedbackId] NVARCHAR(1000) NOT NULL,
    [url] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FeedbackPhoto_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [FeedbackPhoto_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FeedbackPhoto_feedbackId_idx] ON [dbo].[FeedbackPhoto]([feedbackId]);

-- AddForeignKey
ALTER TABLE [dbo].[FeedbackPhoto] ADD CONSTRAINT [FeedbackPhoto_feedbackId_fkey] FOREIGN KEY ([feedbackId]) REFERENCES [dbo].[Feedback]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
