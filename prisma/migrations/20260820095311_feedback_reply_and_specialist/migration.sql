BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Feedback] ADD
[reply] NVARCHAR(max),
[repliedById] NVARCHAR(1000),
[repliedAt] DATETIME2,
[accepted] BIT NOT NULL CONSTRAINT [Feedback_accepted_df] DEFAULT 0,
[flaggedByStore] BIT NOT NULL CONSTRAINT [Feedback_flaggedByStore_df] DEFAULT 0;

-- AddForeignKey
ALTER TABLE [dbo].[Feedback] ADD CONSTRAINT [Feedback_repliedById_fkey] FOREIGN KEY ([repliedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
