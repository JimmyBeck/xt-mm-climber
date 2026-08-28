import ExcelJS from 'exceljs';
import saveAs from 'file-saver';
import JSZip from 'jszip';
import type { XhsNote, XhsComment } from '../types';

/**
 * 获取精确到秒的时间戳字符串 (如 20260828_104523)
 */
export function getSecondPrecisionTimestamp(): string {
  const now = new Date();
  const Y = now.getFullYear();
  const M = String(now.getMonth() + 1).padStart(2, '0');
  const D = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${Y}${M}${D}_${h}${m}${s}`;
}

/**
 * 导出小红书笔记为美观的 Excel 表格
 */
export async function exportNotesToExcel(notes: XhsNote[], fileName = '小天媒媒助手_小红书笔记'): Promise<void> {
  if (!notes || notes.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '小天媒媒助手';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('笔记数据');

  worksheet.columns = [
    { header: '笔记ID', key: 'id', width: 26 },
    { header: '标题', key: 'title', width: 30 },
    { header: '类型', key: 'type', width: 10 },
    { header: '发布时间', key: 'dateStr', width: 20 },
    { header: '作者昵称', key: 'authorName', width: 18 },
    { header: '作者ID', key: 'authorId', width: 26 },
    { header: '点赞数', key: 'likedCount', width: 12 },
    { header: '收藏数', key: 'collectedCount', width: 12 },
    { header: '评论数', key: 'commentCount', width: 12 },
    { header: '分享数', key: 'shareCount', width: 12 },
    { header: 'IP属地', key: 'ipLocation', width: 12 },
    { header: '标签', key: 'tags', width: 22 },
    { header: '笔记链接', key: 'url', width: 45 },
    { header: '无水印原图直链(多张逗号分隔)', key: 'images', width: 45 },
    { header: '无水印视频直链', key: 'videoUrl', width: 45 },
    { header: '正文内容', key: 'desc', width: 40 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Microsoft YaHei', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF2442' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  notes.forEach((note) => {
    const row = worksheet.addRow({
      id: note.id,
      title: note.title,
      type: note.type === 'video' ? '视频' : '图文',
      dateStr: note.dateStr,
      authorName: note.author.name,
      authorId: note.author.id,
      likedCount: note.interactInfo.likedCount,
      collectedCount: note.interactInfo.collectedCount,
      commentCount: note.interactInfo.commentCount,
      shareCount: note.interactInfo.shareCount,
      ipLocation: note.ipLocation,
      tags: note.tagList.join(', '),
      url: note.url,
      images: note.images.join('\n'),
      videoUrl: note.videoUrl || '',
      desc: note.desc,
    });

    row.alignment = { vertical: 'middle', wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const timeTag = getSecondPrecisionTimestamp();
  saveAs(blob, `${fileName}_${timeTag}.xlsx`);
}

/**
 * 导出小红书评论为 Excel（支持一级评论与展开的二级子回复层级区分）
 */
export async function exportCommentsToExcel(comments: XhsComment[], fileName = '小天媒媒助手_小红书全量评论'): Promise<void> {
  if (!comments || comments.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('评论与子回复数据');

  worksheet.columns = [
    { header: '评论ID', key: 'id', width: 26 },
    { header: '评论层级', key: 'levelText', width: 14 },
    { header: '所属主评ID', key: 'rootCommentId', width: 26 },
    { header: '回复对象', key: 'targetUserName', width: 18 },
    { header: '关联笔记ID', key: 'noteId', width: 26 },
    { header: '评论内容', key: 'content', width: 45 },
    { header: '评论者昵称', key: 'authorName', width: 18 },
    { header: '评论者ID', key: 'authorId', width: 26 },
    { header: '点赞数', key: 'likeCount', width: 12 },
    { header: '子回复数(仅主评)', key: 'subCommentCount', width: 16 },
    { header: 'IP属地', key: 'ipLocation', width: 12 },
    { header: '发布时间', key: 'dateStr', width: 20 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Microsoft YaHei', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF2442' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  comments.forEach((c) => {
    const row = worksheet.addRow({
      id: c.id,
      levelText: c.level === 2 ? '↳ 二级子回复' : '★ 一级主评',
      rootCommentId: c.rootCommentId || '',
      targetUserName: c.targetUser?.name || '',
      noteId: c.noteId,
      content: c.content,
      authorName: c.author.name,
      authorId: c.author.id,
      likeCount: c.likeCount,
      subCommentCount: c.level === 1 ? c.subCommentCount : '',
      ipLocation: c.ipLocation,
      dateStr: c.dateStr,
    });
    row.alignment = { vertical: 'middle', wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const timeTag = getSecondPrecisionTimestamp();
  saveAs(blob, `${fileName}_${timeTag}.xlsx`);
}

/**
 * 批量下载指定笔记的高清无水印素材打包为 ZIP
 */
export async function downloadNoteMediaAsZip(note: XhsNote, onProgress?: (percent: number) => void): Promise<void> {
  const zip = new JSZip();
  const folderName = `${note.author.name}_${note.title.slice(0, 15) || note.id}`;
  const folder = zip.folder(folderName);
  if (!folder) return;

  const total = note.images.length + (note.videoUrl ? 1 : 0);
  let completed = 0;

  for (let i = 0; i < note.images.length; i++) {
    const imgUrl = note.images[i];
    try {
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      folder.file(`image_${i + 1}.jpg`, blob);
    } catch (e) {
      console.error(`下载图片失败: ${imgUrl}`, e);
    }
    completed++;
    if (onProgress) onProgress(Math.round((completed / total) * 100));
  }

  if (note.videoUrl) {
    try {
      const res = await fetch(note.videoUrl);
      const blob = await res.blob();
      folder.file(`video_${note.id}.mp4`, blob);
    } catch (e) {
      console.error(`下载视频失败: ${note.videoUrl}`, e);
    }
    completed++;
    if (onProgress) onProgress(Math.round((completed / total) * 100));
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const timeTag = getSecondPrecisionTimestamp();
  saveAs(zipBlob, `${folderName}_${timeTag}.zip`);
}
