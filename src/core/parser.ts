import type { XhsNote, XhsComment, XhsAuthor, XhsInteractInfo } from '../types';

/**
 * 格式化时间戳为可读日期
 */
export function formatTimestamp(ts: number): string {
  if (!ts) return '';
  const date = new Date(ts > 1e11 ? ts : ts * 1000);
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

/**
 * 提取高清无水印图片链接
 * 小红书 CDN 图片通常在 ! 后面带有水印与缩放参数，剔除后即为高清原图
 */
export function cleanImageUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl;
  if (url.startsWith('//')) {
    url = 'https:' + url;
  }
  if (url.includes('!')) {
    url = url.split('!')[0];
  }
  if (url.includes('?imageView2')) {
    url = url.split('?imageView2')[0];
  }
  return url;
}

/**
 * 解析小红书单篇笔记原始对象
 */
export function parseRawNote(rawItem: any): XhsNote | null {
  try {
    if (!rawItem) return null;
    const noteCard = rawItem.note_card || rawItem.note || rawItem;
    if (!noteCard) return null;

    const id = noteCard.note_id || noteCard.id || rawItem.note_id || rawItem.id;
    if (!id) return null;

    const xsecToken = noteCard.xsec_token || rawItem.xsec_token || '';
    const title = noteCard.display_title || noteCard.title || '';
    const desc = noteCard.desc || '';
    const type = noteCard.type === 'video' ? 'video' : 'normal';

    const authorRaw = noteCard.user || rawItem.user || {};
    const author: XhsAuthor = {
      id: authorRaw.user_id || authorRaw.id || '',
      name: authorRaw.nickname || authorRaw.name || '小红书用户',
      avatar: cleanImageUrl(authorRaw.avatar || authorRaw.image || ''),
    };

    const interactRaw = noteCard.interact_info || rawItem.interact_info || {};
    const interactInfo: XhsInteractInfo = {
      likedCount: Number(interactRaw.liked_count || interactRaw.likedCount || 0),
      collectedCount: Number(interactRaw.collected_count || interactRaw.collectedCount || 0),
      commentCount: Number(interactRaw.comment_count || interactRaw.commentCount || 0),
      shareCount: Number(interactRaw.share_count || interactRaw.shareCount || 0),
    };

    // 标签提取
    const tagList: string[] = [];
    if (Array.isArray(noteCard.tag_list)) {
      noteCard.tag_list.forEach((t: any) => {
        if (t?.name) tagList.push(t.name);
      });
    }

    // 图片提取（去水印）
    const images: string[] = [];
    if (Array.isArray(noteCard.image_list)) {
      noteCard.image_list.forEach((img: any) => {
        const rawUrl = img.url_default || img.url_pre || img.url || img.info_list?.[0]?.url;
        if (rawUrl) {
          images.push(cleanImageUrl(rawUrl));
        }
      });
    } else if (noteCard.cover) {
      const coverUrl = noteCard.cover.url_default || noteCard.cover.url_pre || noteCard.cover.url;
      if (coverUrl) images.push(cleanImageUrl(coverUrl));
    }

    // 视频提取
    let videoUrl = '';
    if (type === 'video' && noteCard.video?.media?.stream) {
      const streams = noteCard.video.media.stream.h264 || noteCard.video.media.stream.h265 || [];
      if (streams.length > 0) {
        videoUrl = streams[0].master_url || streams[0].backup_urls?.[0] || '';
      }
    }

    const time = Number(noteCard.time || noteCard.create_time || Date.now());
    const dateStr = formatTimestamp(time);
    const ipLocation = noteCard.ip_location || '';
    const noteUrl = `https://www.xiaohongshu.com/explore/${id}${xsecToken ? `?xsec_token=${xsecToken}` : ''}`;

    return {
      id,
      xsecToken,
      title,
      desc,
      type,
      author,
      interactInfo,
      tagList,
      ipLocation,
      time,
      dateStr,
      images,
      videoUrl,
      url: noteUrl,
    };
  } catch (err) {
    console.warn('[XHS-Parser] 解析笔记失败:', err, rawItem);
    return null;
  }
}

/**
 * 批量解析 Feed、搜索结果或博主发布列表返回的笔记
 */
export function parseNotesPayload(payload: any): XhsNote[] {
  const notes: XhsNote[] = [];
  if (!payload) return notes;

  const items =
    payload.notes ||
    payload.items ||
    payload.data?.notes ||
    payload.data?.items ||
    (Array.isArray(payload) ? payload : []);

  if (Array.isArray(items)) {
    items.forEach((item: any) => {
      const parsed = parseRawNote(item);
      if (parsed) notes.push(parsed);
    });
  }

  if (notes.length === 0 && (payload.note_card || payload.data?.note_card)) {
    const single = parseRawNote(payload.note_card || payload.data?.note_card);
    if (single) notes.push(single);
  }

  return notes;
}

/**
 * 解析单条评论（兼容一级评论与二级子评论）
 */
function parseSingleComment(c: any, defaultNoteId: string, level: 1 | 2 = 1, rootId?: string): XhsComment | null {
  try {
    const id = c.id || c.comment_id;
    if (!id) return null;
    const content = c.content || c.text || '';
    const author: XhsAuthor = {
      id: c.user_info?.user_id || c.user?.id || '',
      name: c.user_info?.nickname || c.user?.name || '匿名用户',
      avatar: cleanImageUrl(c.user_info?.image || c.user?.avatar || ''),
    };
    const likeCount = Number(c.like_count || c.likes || 0);
    const subCommentCount = Number(c.sub_comment_count || 0);
    const ipLocation = c.ip_location || '';
    const createTime = Number(c.create_time || Date.now());
    const dateStr = formatTimestamp(createTime);

    let targetUser: { id: string; name: string } | undefined;
    if (c.target_comment?.user_info) {
      targetUser = {
        id: c.target_comment.user_info.user_id || '',
        name: c.target_comment.user_info.nickname || '',
      };
    }

    return {
      id,
      noteId: defaultNoteId || c.note_id || '',
      level,
      rootCommentId: rootId || (level === 2 ? c.root_comment_id : undefined),
      targetUser,
      content,
      author,
      likeCount,
      subCommentCount,
      ipLocation,
      createTime,
      dateStr,
    };
  } catch (e) {
    return null;
  }
}

/**
 * 解析评论响应（自动提取一级评论与内嵌的二级子评论）
 */
export function parseCommentsPayload(payload: any, noteId: string): XhsComment[] {
  const result: XhsComment[] = [];
  if (!payload) return result;

  const rawComments = payload.comments || payload.data?.comments || (Array.isArray(payload) ? payload : []);
  if (!Array.isArray(rawComments)) return result;

  rawComments.forEach((c: any) => {
    // 1. 解析一级评论
    const primary = parseSingleComment(c, noteId, 1);
    if (primary) {
      result.push(primary);

      // 2. 如果一级评论中附带了初始返回的 sub_comments，一并解析平铺
      if (Array.isArray(c.sub_comments) && c.sub_comments.length > 0) {
        c.sub_comments.forEach((sub: any) => {
          const subItem = parseSingleComment(sub, noteId, 2, primary.id);
          if (subItem) result.push(subItem);
        });
      }
    }
  });

  return result;
}

/**
 * 专门解析二级子评论响应 (/api/sns/web/v2/comment/sub/page)
 */
export function parseSubCommentsPayload(payload: any, noteId: string, rootCommentId: string): XhsComment[] {
  const result: XhsComment[] = [];
  if (!payload) return result;

  const rawComments = payload.comments || payload.data?.comments || [];
  if (!Array.isArray(rawComments)) return result;

  rawComments.forEach((c: any) => {
    const item = parseSingleComment(c, noteId, 2, rootCommentId);
    if (item) result.push(item);
  });

  return result;
}
