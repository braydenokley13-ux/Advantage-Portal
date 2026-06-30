/**
 * Editor assignment by round-robin rotation.
 *
 * New submissions are spread evenly across the board by rotating through
 * {@link BOARD_MEMBERS}. The rotation is stateless: it is driven by how many
 * submissions already exist, so `submission N` goes to `board[N % boardSize]`.
 * This keeps assignment balanced without storing a rotation pointer and scales
 * to any number of submissions.
 */
import { BOARD_MEMBERS, type BoardMember } from "./config";

/**
 * Pick the editor for the next submission given how many already exist.
 *
 * @param existingCount Number of submissions already in the table.
 * @param board         Board roster (defaults to the configured BOARD_MEMBERS).
 *                      Injected in tests.
 */
export function assignEditorByRotation(
  existingCount: number,
  board: readonly BoardMember[] = BOARD_MEMBERS
): BoardMember {
  if (board.length === 0) {
    throw new Error("Cannot assign an editor: the board roster is empty.");
  }
  // Guard against a negative/NaN count so the modulo never yields a bad index.
  const safeCount =
    Number.isFinite(existingCount) && existingCount > 0
      ? Math.floor(existingCount)
      : 0;
  return board[safeCount % board.length];
}
