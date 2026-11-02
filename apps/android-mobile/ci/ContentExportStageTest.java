package com.tongmutvplus.mobile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.ArrayList;

public final class ContentExportStageTest {
    private static final ArrayList<ContentExportStage> stages = new ArrayList<>();
    private static final String NONCE = "a".repeat(64);
    private static final String FOREIGN = "b".repeat(64);
    private interface Throwing { void run() throws Exception; }
    private static void rejected(Throwing action) throws Exception {
        try { action.run(); } catch (IOException expected) { return; }
        throw new AssertionError("Invalid export operation accepted");
    }
    private static ContentExportStage stage(File directory, long size, long[] time) throws IOException {
        ContentExportStage value = new ContentExportStage(directory, NONCE, "export_1", size, () -> time[0]);
        stages.add(value);
        return value;
    }
    private static void empty(File directory) {
        if (directory.list().length != 1 || !new File(directory, "unrelated.txt").isFile())
            throw new AssertionError("Staging leak or unrelated file removed");
    }
    public static void main(String[] args) throws Exception {
        File directory = Files.createTempDirectory("tm-export-test-").toFile();
        File neighbor = new File(directory, "unrelated.txt");
        Files.write(neighbor.toPath(), new byte[] {42});
        long[] time = {1000};
        try {
            byte[] bytes = new byte[ContentExportStage.CHUNK_BYTES + 3];
            for (int index = 0; index < bytes.length; index++) bytes[index] = (byte) (index % 251);
            ContentExportStage good = stage(directory, bytes.length, time);
            rejected(() -> good.append(FOREIGN, "export_1", 0, new byte[] {9}));
            rejected(() -> good.append(NONCE, "other", 0, new byte[] {9}));
            if (good.append(NONCE, "export_1", 0, Arrays.copyOf(bytes, ContentExportStage.CHUNK_BYTES)) != ContentExportStage.CHUNK_BYTES)
                throw new AssertionError("Wrong acknowledged byte count");
            good.append(NONCE, "export_1", 1, Arrays.copyOfRange(bytes, ContentExportStage.CHUNK_BYTES, bytes.length));
            File saved = good.complete(NONCE, "export_1");
            if (!directory.getCanonicalFile().equals(saved.getCanonicalFile().getParentFile()) || !Arrays.equals(bytes, Files.readAllBytes(saved.toPath())))
                throw new AssertionError("Staged bytes or destination changed");
            rejected(() -> good.complete(NONCE, "export_1"));
            rejected(() -> good.append(NONCE, "export_1", 2, new byte[] {1}));
            good.close();
            if (!saved.isFile()) throw new AssertionError("Handed-off export deleted by old owner");
            Files.delete(saved.toPath());
            empty(directory);

            ContentExportStage reordered = stage(directory, 2, time);
            rejected(() -> reordered.append(NONCE, "export_1", 1, new byte[] {1}));
            empty(directory);
            ContentExportStage duplicate = stage(directory, 2, time);
            duplicate.append(NONCE, "export_1", 0, new byte[] {1});
            rejected(() -> duplicate.append(NONCE, "export_1", 0, new byte[] {2}));
            empty(directory);
            ContentExportStage shortFile = stage(directory, 2, time);
            shortFile.append(NONCE, "export_1", 0, new byte[] {1});
            rejected(() -> shortFile.complete(NONCE, "export_1"));
            empty(directory);
            ContentExportStage large = stage(directory, 1, time);
            rejected(() -> large.append(NONCE, "export_1", 0, new byte[65537]));
            empty(directory);
            ContentExportStage excess = stage(directory, 1, time);
            rejected(() -> excess.append(NONCE, "export_1", 0, new byte[2]));
            empty(directory);
            ContentExportStage idle = stage(directory, 1, time);
            time[0] += 60001;
            rejected(() -> idle.append(NONCE, "export_1", 0, new byte[] {1}));
            empty(directory);
            ContentExportStage duration = stage(directory, 10, time);
            for (int index = 0; index < 6; index++) {
                duration.append(NONCE, "export_1", index, new byte[] {1});
                time[0] += 50000;
            }
            time[0]++;
            rejected(() -> duration.append(NONCE, "export_1", 6, new byte[] {1}));
            empty(directory);
            ContentExportStage canceled = stage(directory, 2, time);
            canceled.append(NONCE, "export_1", 0, new byte[] {1});
            canceled.close();
            rejected(() -> canceled.complete(NONCE, "export_1"));
            empty(directory);
            rejected(() -> stage(directory, ContentExportStage.MAX_BYTES + 1, time));
            rejected(() -> stage(directory, -1, time));
            rejected(() -> new ContentExportStage(directory, NONCE, "../path", 1, () -> time[0]));
            empty(directory);
            if (Files.readAllBytes(neighbor.toPath())[0] != 42) throw new AssertionError("Unrelated content changed");
            System.out.println("PASS: exact bounded bytes, scope/sequence/size/time/cancel checks, ownership handoff and unrelated file preservation");
        } finally {
            for (ContentExportStage value : stages) value.close();
            for (File owned : directory.listFiles()) Files.delete(owned.toPath());
            Files.delete(directory.toPath());
        }
    }
}
