package com.orangefamily.photossync.sync

object MultipartUploadRules {
    fun missingParts(partsTotal: Int, completedPartNumbers: Set<Int>): List<Int> =
        (1..partsTotal).filterNot(completedPartNumbers::contains)

    fun partLength(sizeBytes: Long, partSize: Long, partNumber: Int): Long =
        minOf(partSize, sizeBytes - (partNumber - 1L) * partSize)

    fun confirmedBytes(sizeBytes: Long, partSize: Long, completedPartNumbers: Set<Int>): Long =
        completedPartNumbers.sumOf { partLength(sizeBytes, partSize, it) }
}
