import React, { useEffect, useId, useRef } from 'react';
import { Drawer, IconButton, Tab, Tabs } from '@mui/material';
import { X } from 'lucide-react';

import BooEmptyState from '../../components/BooEmptyState';

const InquiryHistoryDrawer = ({
  open,
  status,
  onStatusChange,
  onClose,
  openInquiries,
  resolvedInquiries,
  hasList,
  showEmptyState,
  notice,
  renderRow,
}) => {
  const id = useId();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [open, status]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': `${id}-title`,
          sx: {
            width: { xs: '100%', sm: 580 },
            maxWidth: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        },
      }}>
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-4">
        <h2 id={`${id}-title`} className="text-xl font-bold text-[#002D56]">
          전체 문의 이력
        </h2>
        <IconButton
          aria-label="문의 이력 닫기"
          onClick={onClose}
          sx={{ width: 44, height: 44 }}>
          <X aria-hidden="true" size={22} />
        </IconButton>
      </div>
      <Tabs
        value={status}
        onChange={(_, value) => onStatusChange(value)}
        aria-label="문의 이력 상태"
        variant="fullWidth"
        sx={{ flexShrink: 0, borderBottom: '1px solid #e5e7eb' }}>
        <Tab
          id={`${id}-OPEN-tab`}
          value="OPEN"
          label={`답변 대기 ${openInquiries.length}건`}
          aria-controls={`${id}-OPEN-panel`}
        />
        <Tab
          id={`${id}-RESOLVED-tab`}
          value="RESOLVED"
          label={`답변 완료 ${resolvedInquiries.length}건`}
          aria-controls={`${id}-RESOLVED-panel`}
        />
      </Tabs>
      {['OPEN', 'RESOLVED'].map(panelStatus => {
        const active = status === panelStatus;
        const inquiries =
          panelStatus === 'RESOLVED' ? resolvedInquiries : openInquiries;
        const label = panelStatus === 'RESOLVED' ? '답변 완료' : '답변 대기';
        return (
          <div
            key={panelStatus}
            ref={active ? scrollRef : null}
            role="tabpanel"
            id={`${id}-${panelStatus}-panel`}
            aria-labelledby={`${id}-${panelStatus}-tab`}
            hidden={!active}
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 outline-offset-[-2px]">
            {active && (
              <>
                {notice}
                {hasList &&
                  (inquiries.length > 0 ? (
                    <ul className="space-y-3">{inquiries.map(renderRow)}</ul>
                  ) : showEmptyState ? (
                    <BooEmptyState
                      variant="compact"
                      illustration="inquiry"
                      title={`${label} 문의가 없습니다.`}
                      description={
                        panelStatus === 'RESOLVED'
                          ? '답변이 도착하면 여기에서 다시 확인할 수 있어요.'
                          : '답변을 기다리는 문의가 생기면 여기에 모아 둘게요.'
                      }
                    />
                  ) : null)}
              </>
            )}
          </div>
        );
      })}
    </Drawer>
  );
};

export default InquiryHistoryDrawer;
