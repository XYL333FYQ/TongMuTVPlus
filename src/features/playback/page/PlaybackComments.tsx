'use client';

import './PlaybackComments.css';

import AIComments from '@/components/AIComments';
import DoubanComments from '@/components/DoubanComments';

interface PlaybackCommentsProps {
  videoDoubanId: number;
  videoTitle: string;
  /** 后台开关：豆瓣短评、AI 短评 */
  enableComments: boolean;
  enableAIComments: boolean;
}

/** 画面下方的豆瓣短评和 AI 短评 */
export default function PlaybackComments({
  videoDoubanId,
  videoTitle,
  enableComments,
  enableAIComments,
}: PlaybackCommentsProps) {
  return (
    <>
      {/* 豆瓣评论区域 */}
      {videoDoubanId !== 0 && enableComments && (
        <div className='tm-pcomments-div-1'>
          <div className='tm-pcomments-div-2'>
            {/* 标题 */}
            <div className='tm-pcomments-div-3'>
              <h3 className='tm-pcomments-h3-1'>
                <svg
                  className='tm-pcomments-svg-1'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z' />
                </svg>
                豆瓣评论
              </h3>
            </div>

            {/* 评论内容 */}
            <div className='tm-pcomments-div-4'>
              <DoubanComments doubanId={videoDoubanId} />
            </div>
          </div>
        </div>
      )}

      {/* AI评论区域 */}
      {videoTitle && enableAIComments && (
        <div className='tm-pcomments-div-1'>
          <div className='tm-pcomments-div-2'>
            {/* 标题 */}
            <div className='tm-pcomments-div-3'>
              <h3 className='tm-pcomments-h3-1'>
                <svg
                  className='tm-pcomments-svg-2'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path d='M13 10V3L4 14h7v7l9-11h-7z' />
                </svg>
                AI生成评论
              </h3>
            </div>

            {/* 评论内容 */}
            <div className='tm-pcomments-div-4'>
              <AIComments movieName={videoTitle} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
