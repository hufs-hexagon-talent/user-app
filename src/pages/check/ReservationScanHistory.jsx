import React from 'react';
import { Modal } from 'flowbite-react';
import { format } from 'date-fns';
import { useReservationScans } from '../../api/checkin.api';
import {
  formatRoom,
  formatReservationTime,
  reservationStateLabel,
} from '../inquiry/reservationView';

const results = {
  ATTENDED: '출석 완료',
  ALREADY_ATTENDED: '기존 출석 유지',
  ADMIN_CORRECTION: '관리자 정정 유지',
  CANCELLED_OR_DELETED: '취소·삭제된 예약',
  UNVERIFIED_TIME: 'QR 인식 시각 확인 필요',
  TOO_LATE: '24시간 전송 기한 초과',
  EXPIRED_QR: 'QR 유효시간 만료',
  TOO_EARLY: '출석 가능 시간 전',
  OUTSIDE_WINDOW: '예약 이용 시간 종료',
  WRONG_ROOM: '예약과 다른 호실',
  UNKNOWN_QR: 'QR 확인 필요',
};
const timestamp = at =>
  at ? format(new Date(at), 'yyyy-MM-dd HH:mm:ss') : '확인되지 않음';

export default function ReservationScanHistory({ reservation, onClose }) {
  const { data, isPending, isError, refetch } = useReservationScans(
    reservation.reservationId,
  );
  return (
    <Modal show onClose={onClose} size="md" dismissible>
      <Modal.Header>출석 기록</Modal.Header>
      <Modal.Body>
        <p className="font-semibold">{formatRoom(reservation)}</p>
        <p className="mb-4 text-sm">{formatReservationTime(reservation)}</p>
        {isPending && <p role="status">기록을 불러오는 중입니다.</p>}
        {isError && (
          <p role="status">
            기록을 불러오지 못했습니다.{' '}
            <button className="underline" onClick={() => refetch()}>
              다시 시도
            </button>
          </p>
        )}
        {data?.length === 0 && (
          <>
            <p>현재 예약 상태 · {reservationStateLabel(reservation)}</p>
            <p className="mt-2 text-gray-700">
              서버에서 확인된 QR 기록이 없습니다. 키오스크가 연결되면 기록이
              갱신됩니다.
            </p>
          </>
        )}
        {data?.map((scan, i) => (
          <dl
            key={i}
            className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t py-4 text-sm">
            <dt>출석 결과</dt>
            <dd className="font-semibold">
              {results[scan.result] ?? '확인 필요'}
            </dd>
            <dt>QR 인식 시각</dt>
            <dd>{timestamp(scan.scannedAt)}</dd>
            <dt>출석 반영 시각</dt>
            <dd>
              {scan.appliedAt
                ? timestamp(scan.appliedAt)
                : scan.result === 'ALREADY_ATTENDED'
                  ? '기존 출석 유지'
                  : '반영되지 않음'}
            </dd>
          </dl>
        ))}
      </Modal.Body>
    </Modal>
  );
}
