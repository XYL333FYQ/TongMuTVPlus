/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  CategoryNode,
  getChildCategories,
  getParentCategories,
  isHierarchicalCategories,
  pickDefaultSelection,
} from '@/lib/category-tree';
import { getPageScrollTop, scrollPageTo } from '@/lib/page-scroll';
import { SearchResult } from '@/lib/types';
import { useViewerIdentity } from '@/hooks/useViewerIdentity';

import CapsuleSwitch from '@/components/catalog/CapsuleSwitch';
import PosterGrid from '@/components/catalog/PosterGrid';
import PublicCatalogPage from '@/components/catalog/PublicCatalogPage';
import RetryNotice from '@/components/feedback/RetryNotice';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import BackToTop from '@/components/shell/BackToTop';
import PageHeader from '@/components/shell/PageHeader';
import VideoCard from '@/components/VideoCard';

interface DuanjuSource {
  key: string;
  name: string;
  api: string;
  typeId?: string;
  typeName?: string;
}

// 观影前保存的浏览快照，返回后恢复到上一步操作位置
const DUANJU_STATE_KEY = 'duanju_state';

interface DuanjuSnapshot {
  sources: DuanjuSource[];
  selectedSource: string;
  categories: CategoryNode[];
  selectedParentCategory: string;
  selectedCategory: string;
  videos: SearchResult[];
  currentPage: number;
  hasMore: boolean;
  scrollTop: number;
}

// 恢复动作需要在绘制前完成，避免闪现顶部；SSR 下退化为 useEffect
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

// 读取并消费快照：只在观影返回后恢复一次
const consumeSnapshot = (): DuanjuSnapshot | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DUANJU_STATE_KEY);
    sessionStorage.removeItem(DUANJU_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DuanjuSnapshot;
    if (
      !parsed?.selectedSource ||
      !Array.isArray(parsed.sources) ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.videos) ||
      parsed.videos.length === 0
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

function DuanjuPageClient() {
  const [sources, setSources] = useState<DuanjuSource[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [selectedParentCategory, setSelectedParentCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [videos, setVideos] = useState<SearchResult[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // 请求失败的提示；重试计数变化会让对应 effect 重新请求同一页
  const [sourcesError, setSourcesError] = useState('');
  const [videosError, setVideosError] = useState('');
  const [sourcesRetry, setSourcesRetry] = useState(0);
  const [videosRetry, setVideosRetry] = useState(0);
  // 快照读取完成前不发请求，避免覆盖恢复的数据
  const [restoreChecked, setRestoreChecked] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const sourceScrollContainerRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<DuanjuSnapshot | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  // 恢复时需要跳过一次「拉取分类」和「拉取列表」
  const skipCategoryFetchRef = useRef(false);
  const skipVideoFetchRef = useRef(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // 读取观影前保存的快照，恢复到上一步操作位置
  useIsomorphicLayoutEffect(() => {
    const snapshot = consumeSnapshot();
    if (snapshot) {
      skipCategoryFetchRef.current = true;
      skipVideoFetchRef.current = true;
      pendingScrollTopRef.current = snapshot.scrollTop;
      setSources(snapshot.sources);
      setSelectedSource(snapshot.selectedSource);
      setCategories(snapshot.categories);
      // 旧快照没有一级分类时，从已选分类反推
      setSelectedParentCategory(
        snapshot.selectedParentCategory ||
          snapshot.categories.find(
            (item) => item.id === snapshot.selectedCategory
          )?.pid ||
          ''
      );
      setSelectedCategory(snapshot.selectedCategory);
      setVideos(snapshot.videos);
      setCurrentPage(snapshot.currentPage);
      setHasMore(snapshot.hasMore);
    }
    setRestoreChecked(true);
  }, []);

  // 列表渲染完成后再恢复滚动位置
  useIsomorphicLayoutEffect(() => {
    const target = pendingScrollTopRef.current;
    if (target == null || videos.length === 0) return;

    pendingScrollTopRef.current = null;
    scrollPageTo(target);
    const rafId = requestAnimationFrame(() => scrollPageTo(target));
    return () => cancelAnimationFrame(rafId);
  }, [videos]);

  // 镜像最新状态，供跳转播放页前保存快照
  useEffect(() => {
    snapshotRef.current = {
      sources,
      selectedSource,
      categories,
      selectedParentCategory,
      selectedCategory,
      videos,
      // 当前页还在请求中或已失败，回退一页以便返回后重新拉取，避免缺页
      currentPage:
        (isLoadingVideos || videosError) && currentPage > 1
          ? currentPage - 1
          : currentPage,
      hasMore,
      scrollTop: 0,
    };
  }, [
    sources,
    selectedSource,
    categories,
    selectedParentCategory,
    selectedCategory,
    videos,
    currentPage,
    hasMore,
    isLoadingVideos,
    videosError,
  ]);

  // 跳转播放页前保存当前浏览位置
  const saveSnapshot = useCallback(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot || snapshot.videos.length === 0) return;
    try {
      sessionStorage.setItem(
        DUANJU_STATE_KEY,
        JSON.stringify({ ...snapshot, scrollTop: getPageScrollTop() })
      );
    } catch {
      // 忽略 sessionStorage 写入失败（如超出配额）
    }
  }, []);

  // 加载包含短剧分类的采集源
  useEffect(() => {
    if (!restoreChecked) return;

    let cancelled = false;
    const fetchSources = async () => {
      setIsLoadingSources(true);
      setSourcesError('');
      try {
        const response = await fetch('/api/duanju/sources');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        if (data.code !== 200 || !Array.isArray(data.data)) {
          throw new Error(data.message || '采集源格式不正确');
        }
        const list = data.data as DuanjuSource[];
        setSources(list);
        // 默认选择第一个源（恢复的源仍可用时保持不变）
        if (list.length > 0) {
          setSelectedSource((prev) =>
            prev && list.some((source) => source.key === prev)
              ? prev
              : list[0].key
          );
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load duanju sources:', error);
        setSourcesError('采集源暂时无法获取');
      } finally {
        if (!cancelled) setIsLoadingSources(false);
      }
    };

    fetchSources();
    return () => {
      cancelled = true;
    };
  }, [restoreChecked, sourcesRetry]);

  const handleSourceChange = (sourceKey: string) => {
    const source = sources.find((item) => item.key === sourceKey);
    setSelectedSource(sourceKey);
    setCategories([]);
    setSelectedParentCategory('');
    // 先用采集源标记的短剧分类直接拉列表，分类加载后再细化选择
    setSelectedCategory(source?.typeId || '');
    setCurrentPage(1);
    setVideos([]);
    setHasMore(true);
  };

  // 当选择的源变化时，加载该源的短剧分类（含二级分类）
  useEffect(() => {
    if (!restoreChecked || !selectedSource) return;

    // 恢复场景下分类与列表都来自快照，无需重新拉取
    if (skipCategoryFetchRef.current) {
      skipCategoryFetchRef.current = false;
      return;
    }

    let cancelled = false;
    const fetchCategories = async () => {
      try {
        const response = await fetch(
          `/api/duanju/categories?source=${encodeURIComponent(selectedSource)}`
        );
        const data = await response.json();
        if (cancelled) return;
        if (data.code === 200 && Array.isArray(data.data)) {
          const list = data.data as CategoryNode[];
          setCategories(list);
          if (list.length === 0) {
            setSelectedParentCategory('');
            setSelectedCategory('');
            return;
          }

          const ids = new Set(list.map((item) => item.id));
          const parents = isHierarchicalCategories(list)
            ? getParentCategories(list)
            : [];
          const multiParent = parents.length > 1;
          // 默认选中采集源标记的短剧分类，没有时取列表默认项
          const source = sources.find((item) => item.key === selectedSource);
          const preferred = source?.typeId || '';

          if (preferred && ids.has(preferred)) {
            const preferredPid = list.find(
              (item) => item.id === preferred
            )?.pid;
            if (multiParent) {
              const children = getChildCategories(list, preferred);
              setSelectedParentCategory(
                preferredPid && ids.has(preferredPid) ? preferredPid : preferred
              );
              // 与切换类型的行为保持一致：选中有子分类的类型时落到第一个子分类
              setSelectedCategory(
                children.length > 0 ? children[0].id : preferred
              );
            } else {
              setSelectedParentCategory('');
              setSelectedCategory(preferred);
            }
          } else {
            const { parent, category } = pickDefaultSelection(list);
            setSelectedParentCategory(multiParent ? parent : '');
            setSelectedCategory(category);
          }
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load duanju categories:', error);
        // 分类加载失败时回退到采集源标记的短剧分类，保证列表可用
        const source = sources.find((item) => item.key === selectedSource);
        if (source?.typeId) {
          setSelectedParentCategory('');
          setSelectedCategory(source.typeId);
        }
      }
    };

    fetchCategories();
    return () => {
      cancelled = true;
    };
  }, [restoreChecked, selectedSource]);

  // 切换一级分类（类型）时，落到该类型下第一个子分类并重置到第一页
  const handleParentCategoryChange = (value: string) => {
    setSelectedParentCategory(value);
    setCurrentPage(1);
    setVideos([]);
    setHasMore(true);
    const children = getChildCategories(categories, value);
    setSelectedCategory(children.length > 0 ? children[0].id : value);
  };

  // 切换分类时，重置到第一页
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setCurrentPage(1);
    setVideos([]);
    setHasMore(true);
  };

  // 分类展示形态：多个一级分类时为「类型 → 分类」联动；
  // 只有一个一级分类时合并为单行（含一级自身，可直接浏览挂在一级下的内容）
  const isHierarchical = isHierarchicalCategories(categories);
  const parentCategories = isHierarchical
    ? getParentCategories(categories)
    : [];
  const isMultiParent = isHierarchical && parentCategories.length > 1;
  const subCategories =
    isMultiParent && selectedParentCategory
      ? getChildCategories(categories, selectedParentCategory)
      : [];
  const flatCategories = !isHierarchical
    ? categories
    : parentCategories.length === 1
    ? [
        parentCategories[0],
        ...getChildCategories(categories, parentCategories[0].id),
      ]
    : categories;

  // 当选择的分类或页码变化时，加载视频列表
  useEffect(() => {
    if (!restoreChecked || !selectedSource || !selectedCategory) return;

    // 恢复场景下列表已来自快照，跳过本次请求
    if (skipVideoFetchRef.current) {
      skipVideoFetchRef.current = false;
      return;
    }

    let cancelled = false;
    const fetchVideos = async () => {
      setIsLoadingVideos(true);
      setVideosError('');
      try {
        const response = await fetch(
          `/api/duanju/videos?source=${encodeURIComponent(
            selectedSource
          )}&categoryId=${encodeURIComponent(
            selectedCategory
          )}&page=${currentPage}`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        if (data.code !== 200 || !Array.isArray(data.data)) {
          throw new Error(data.message || '列表格式不正确');
        }
        if (currentPage === 1) {
          setVideos(data.data);
        } else {
          setVideos((prev) => [...prev, ...data.data]);
        }
        setHasMore(data.page < data.pageCount);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load duanju videos:', error);
        // 失败后停住自动翻页，保留已加载内容，等用户重试同一页
        setVideosError(
          currentPage === 1
            ? '短剧列表暂时无法获取'
            : '下一页加载失败，已保留当前内容'
        );
      } finally {
        if (!cancelled) setIsLoadingVideos(false);
      }
    };

    fetchVideos();
    return () => {
      cancelled = true;
    };
  }, [
    restoreChecked,
    selectedSource,
    selectedCategory,
    currentPage,
    videosRetry,
  ]);

  // Intersection Observer for infinite scroll
  // 哨兵节点仅在列表非空时渲染；快照恢复不发请求、isLoadingVideos 不翻转，
  // 需要依赖列表出现才能（重新）挂载观察器
  const hasVideos = videos.length > 0;
  useEffect(() => {
    if (!hasVideos || !loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (
          target.isIntersecting &&
          hasMore &&
          !isLoadingVideos &&
          !videosError
        ) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { rootMargin: '240px 0px', threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasVideos, hasMore, isLoadingVideos, videosError]);

  return (
    <PageLayout activePath='/duanju'>
      <PageContainer className='pb-12'>
        <PageHeader title='短剧' description='浏览所有采集源中的短剧' />

        <div className='mb-8'>
          <div className='relative'>
            <div className='tm-field-label'>服务</div>
            {isLoadingSources ? (
              <div className='tm-inline-state'>正在加载采集源</div>
            ) : sourcesError && sources.length === 0 ? (
              <RetryNotice
                message={sourcesError}
                onRetry={() => setSourcesRetry((value) => value + 1)}
              />
            ) : sources.length === 0 ? (
              <div className='tm-inline-state'>还没有包含短剧分类的采集源</div>
            ) : (
              <div className='relative'>
                <div
                  ref={sourceScrollContainerRef}
                  className='overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing'
                  onMouseDown={(e) => {
                    if (!sourceScrollContainerRef.current) return;
                    isDraggingRef.current = true;
                    startXRef.current =
                      e.pageX - sourceScrollContainerRef.current.offsetLeft;
                    scrollLeftRef.current =
                      sourceScrollContainerRef.current.scrollLeft;
                    sourceScrollContainerRef.current.style.cursor = 'grabbing';
                    sourceScrollContainerRef.current.style.userSelect = 'none';
                  }}
                  onMouseLeave={() => {
                    if (!sourceScrollContainerRef.current) return;
                    isDraggingRef.current = false;
                    sourceScrollContainerRef.current.style.cursor = 'grab';
                    sourceScrollContainerRef.current.style.userSelect = 'auto';
                  }}
                  onMouseUp={() => {
                    if (!sourceScrollContainerRef.current) return;
                    isDraggingRef.current = false;
                    sourceScrollContainerRef.current.style.cursor = 'grab';
                    sourceScrollContainerRef.current.style.userSelect = 'auto';
                  }}
                  onMouseMove={(e) => {
                    if (
                      !isDraggingRef.current ||
                      !sourceScrollContainerRef.current
                    )
                      return;
                    e.preventDefault();
                    const x =
                      e.pageX - sourceScrollContainerRef.current.offsetLeft;
                    const walk = (x - startXRef.current) * 2;
                    sourceScrollContainerRef.current.scrollLeft =
                      scrollLeftRef.current - walk;
                  }}
                >
                  <div className='tm-chips flex-nowrap'>
                    {sources.map((source) => (
                      <button
                        key={source.key}
                        onClick={() => handleSourceChange(source.key)}
                        aria-pressed={selectedSource === source.key}
                        className='tm-chip'
                      >
                        {source.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 分类选择：源有二级分类时联动展示 */}
        {selectedSource && categories.length > 1 && (
          <div className='mb-8'>
            {isMultiParent ? (
              <>
                <div className='tm-field-label'>类型</div>
                <div className='mb-4 flex'>
                  <CapsuleSwitch
                    options={parentCategories.map((category) => ({
                      label: category.name,
                      value: category.id,
                    }))}
                    active={selectedParentCategory}
                    onChange={handleParentCategoryChange}
                  />
                </div>
                {subCategories.length > 0 && (
                  <div>
                    <div className='tm-field-label'>分类</div>
                    <div className='flex'>
                      <CapsuleSwitch
                        options={subCategories.map((category) => ({
                          label: category.name,
                          value: category.id,
                        }))}
                        active={selectedCategory}
                        onChange={handleCategoryChange}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div>
                <div className='tm-field-label'>分类</div>
                <div className='flex'>
                  <CapsuleSwitch
                    options={flatCategories.map((category) => ({
                      label: category.name,
                      value: category.id,
                    }))}
                    active={selectedCategory}
                    onChange={handleCategoryChange}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {selectedSource && !selectedCategory && (
          <div className='tm-empty'>
            <p className='tm-empty-title'>当前采集源暂无短剧分类</p>
          </div>
        )}

        {selectedSource && selectedCategory && (
          <div className='mt-8'>
            <div className='mb-4'>
              <h2 className='tm-section-title'>短剧列表</h2>
            </div>

            {isLoadingVideos && currentPage === 1 ? (
              <div className='tm-poster-grid' aria-label='正在加载'>
                {Array.from({ length: 12 }, (_, index) => (
                  <div key={index} className='tm-poster tm-skeleton' />
                ))}
              </div>
            ) : videosError && videos.length === 0 ? (
              <RetryNotice
                message={videosError}
                onRetry={() => setVideosRetry((value) => value + 1)}
              />
            ) : videos.length === 0 ? (
              <div className='tm-empty'>
                <p className='tm-empty-title'>暂无短剧</p>
              </div>
            ) : (
              <>
                <PosterGrid className=''>
                  {videos.map((item) => (
                    <div key={`${item.source}-${item.id}`} className='w-full'>
                      <VideoCard
                        id={item.id}
                        title={item.title}
                        poster={item.poster}
                        episodes={item.episodes.length}
                        source={item.source}
                        source_name={item.source_name}
                        douban_id={item.douban_id}
                        year={item.year}
                        from='source-search'
                        type='tv'
                        isDuanju
                        cmsData={{
                          desc: item.desc,
                          episodes: item.episodes,
                          episodes_titles: item.episodes_titles,
                        }}
                        onBeforeNavigate={saveSnapshot}
                      />
                    </div>
                  ))}
                </PosterGrid>

                <div
                  ref={loadMoreRef}
                  className='flex justify-center items-center py-8'
                >
                  {isLoadingVideos && (
                    <span className='tm-library-end'>正在加载</span>
                  )}
                  {videosError && !isLoadingVideos && (
                    <RetryNotice
                      message={videosError}
                      onRetry={() => setVideosRetry((value) => value + 1)}
                    />
                  )}
                  {!hasMore && !videosError && videos.length > 0 && (
                    <span className='tm-library-end'>已经到底了</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </PageContainer>

      <BackToTop />
    </PageLayout>
  );
}

function DuanjuViewerPage() {
  const { ready, isGuest } = useViewerIdentity();
  if (!ready)
    return (
      <PageLayout activePath='/duanju'>
        <div className='tm-public-feedback' role='status'>
          正在加载
        </div>
      </PageLayout>
    );
  return isGuest ? (
    <PublicCatalogPage mode='library' category='duanju' />
  ) : (
    <DuanjuPageClient />
  );
}

export default function DuanjuPage() {
  return (
    <Suspense>
      <DuanjuViewerPage />
    </Suspense>
  );
}
