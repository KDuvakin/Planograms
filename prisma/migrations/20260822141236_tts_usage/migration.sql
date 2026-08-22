BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[TtsUsage] (
    [id] NVARCHAR(1000) NOT NULL,
    [yearMonth] NVARCHAR(1000) NOT NULL,
    [charactersUsed] INT NOT NULL CONSTRAINT [TtsUsage_charactersUsed_df] DEFAULT 0,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TtsUsage_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TtsUsage_yearMonth_key] UNIQUE NONCLUSTERED ([yearMonth])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
