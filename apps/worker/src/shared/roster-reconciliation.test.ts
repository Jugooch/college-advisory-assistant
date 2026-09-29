/**
 * @file Tests for the roster reconciliation rule.
 */
import { describe, expect, it } from 'vitest';

import { createRosterRow, ImportOperation } from '@caa/domain';
import { buildImportBatch } from '@caa/test-kit';

import { decideReconciliation } from './roster-reconciliation';

const ROW = createRosterRow({ sourceStudentId: 'SYN-000001', recordVersion: 1, isDeleted: false });
const QUARANTINED = { rowIndex: 1, sourceRecordId: null, reason: 'invalid_field:sourceStudentId' };

const full = buildImportBatch({ operation: ImportOperation.Full });
const delta = buildImportBatch({ operation: ImportOperation.Delta });

describe('decideReconciliation', () => {
  it('never reconciles a DELTA, whatever its rows', () => {
    expect(decideReconciliation({ batch: delta, rows: [ROW], quarantined: [] })).toBeNull();
    expect(decideReconciliation({ batch: delta, rows: [], quarantined: [] })).toBeNull();
  });

  it('reconciles a complete, non-empty FULL batch', () => {
    expect(decideReconciliation({ batch: full, rows: [ROW], quarantined: [] })).toBe('COMPLETED');
  });

  it('skips a FULL batch with any quarantined row', () => {
    expect(decideReconciliation({ batch: full, rows: [ROW], quarantined: [QUARANTINED] })).toBe(
      'SKIPPED_QUARANTINED_ROWS',
    );
  });

  it('skips an empty FULL batch', () => {
    expect(decideReconciliation({ batch: full, rows: [], quarantined: [] })).toBe(
      'SKIPPED_EMPTY_SNAPSHOT',
    );
  });

  it('reports quarantined rows first when a FULL batch is both empty of valid rows and quarantined', () => {
    expect(decideReconciliation({ batch: full, rows: [], quarantined: [QUARANTINED] })).toBe(
      'SKIPPED_QUARANTINED_ROWS',
    );
  });
});
