<template>
  <div class="xhs-copilot-root flex font-sans select-none text-slate-800 antialiased" style="position: relative; z-index: 2147483647;">
    <!-- 悬浮触发球 -->
    <button
      v-if="!isOpen"
      @click="isOpen = true"
      class="group flex items-center gap-2 rounded-l-full bg-gradient-to-r from-rose-500 to-red-600 px-4 py-3 text-white shadow-2xl transition-all duration-300 hover:pr-6 hover:shadow-rose-500/30"
      style="background: linear-gradient(135deg, #ff2442 0%, #e0122f 100%); color: #ffffff; padding: 10px 16px; border-top-left-radius: 9999px; border-bottom-left-radius: 9999px; box-shadow: 0 4px 20px rgba(255, 36, 66, 0.45); cursor: pointer; border: none; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;"
      title="打开小天媒媒助手"
    >
      <div class="relative flex items-center justify-center">
        <Sparkles class="h-5 w-5 animate-pulse text-amber-200" style="width: 20px; height: 20px; color: #fde68a;" />
        <span
          v-if="notes.length > 0 || comments.length > 0"
          class="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-900 shadow"
          style="background-color: #fbbf24; color: #0f172a; border-radius: 9999px; padding: 0 4px; font-size: 10px; font-weight: bold;"
        >
          {{ notes.length }}
        </span>
      </div>
      <span class="text-xs font-semibold tracking-wide">小天媒媒助手</span>
    </button>

    <!-- 主抽屉面板 -->
    <transition
      enter-active-class="transform transition ease-in-out duration-300"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transform transition ease-in-out duration-300"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="isOpen"
        class="fixed right-0 top-0 bottom-0 flex w-[560px] max-w-[95vw] flex-col border-l border-slate-200 bg-white shadow-2xl"
        style="position: fixed; right: 0; top: 0; bottom: 0; width: 560px; max-width: 95vw; z-index: 2147483647; background-color: #ffffff; box-shadow: -4px 0 25px rgba(0,0,0,0.15);"
      >
        <!-- 抽屉头部 -->
        <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-3">
          <div class="flex items-center gap-2">
            <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-white shadow-sm shadow-rose-500/30">
              <Flame class="h-4 w-4" />
            </div>
            <div>
              <h2 class="text-sm font-bold text-slate-900 leading-tight">小天媒媒助手</h2>
              <p class="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <ShieldCheck class="h-3.5 w-3.5 text-emerald-500" />
                账号安全第一（真实浏览器宿主 + 错误码自愈）
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="clearData"
              class="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              title="清空当前列表数据"
            >
              <Trash2 class="h-4 w-4" />
            </button>
            <button
              @click="isOpen = false"
              class="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              title="收起面板"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- 顶部常驻：当前打开笔记一键深度采集条（场景 3 快捷入口） -->
        <div
          v-if="currentNoteId"
          class="flex items-center justify-between bg-gradient-to-r from-rose-50 to-pink-50 border-b border-rose-100 px-4 py-2 text-xs"
        >
          <div class="flex items-center gap-1.5 truncate max-w-[320px]">
            <span class="flex h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
            <span class="text-slate-600 font-medium shrink-0">当前打开:</span>
            <span class="font-bold text-rose-700 truncate" :title="currentNoteTitle || currentNoteId">
              {{ currentNoteTitle || `笔记_${currentNoteId.slice(-6)}` }}
            </span>
          </div>
          <button
            :disabled="isCrawling"
            @click="startSingleNoteDeepCrawl(currentNoteId, currentXsecToken)"
            class="flex items-center gap-1 rounded-md bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-600 disabled:opacity-50"
          >
            <Zap class="h-3 w-3" />
            <span>深度采集此篇</span>
          </button>
        </div>

        <!-- 标签页切换 -->
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2 bg-white">
          <div class="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
            <button
              @click="activeTab = 'notes'"
              :class="[
                'rounded-md px-2.5 py-1 text-xs font-semibold transition',
                activeTab === 'notes' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              ]"
            >
              笔记 ({{ notes.length }})
            </button>
            <button
              @click="activeTab = 'comments'"
              :class="[
                'rounded-md px-2.5 py-1 text-xs font-semibold transition',
                activeTab === 'comments' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              ]"
            >
              评论 ({{ comments.length }})
            </button>
            <button
              @click="activeTab = 'automation'"
              :class="[
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition',
                activeTab === 'automation' ? 'bg-rose-500 text-white shadow-sm' : 'text-rose-600 hover:bg-rose-50'
              ]"
            >
              <Sparkles class="h-3 w-3" />
              <span>深度与全量采集</span>
            </button>
            <button
              v-if="latestReport"
              @click="activeTab = 'report'"
              :class="[
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition',
                activeTab === 'report' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-600 hover:bg-indigo-50'
              ]"
            >
              <FileCheck class="h-3 w-3" />
              <span>结算报告</span>
            </button>
          </div>

          <!-- 导出按钮 -->
          <div class="flex items-center gap-1.5">
            <button
              v-if="activeTab === 'notes'"
              :disabled="notes.length === 0 || isExporting"
              @click="handleExportNotes"
              class="flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet class="h-3.5 w-3.5" />
              <span>{{ isExporting ? '导出中...' : '导出笔记 Excel' }}</span>
            </button>
            <button
              v-if="activeTab === 'comments'"
              :disabled="comments.length === 0 || isExporting"
              @click="handleExportComments"
              class="flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet class="h-3.5 w-3.5" />
              <span>{{ isExporting ? '导出中...' : '导出评论 Excel' }}</span>
            </button>
          </div>
        </div>

        <!-- 主内容区 -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <!-- 1. 深度与全量采集 Tab (Automation) -->
          <template v-if="activeTab === 'automation'">
            <div class="space-y-4">
              <!-- 场景 3：指定笔记或多选批量深度采集 -->
              <div class="rounded-xl border border-rose-200/90 bg-gradient-to-br from-rose-50/40 to-white p-4 shadow-xs">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                    <CheckSquare class="h-4 w-4 text-rose-500" />
                    场景 3：手动指定 / 批量勾选笔记深度采集
                  </h3>
                  <span class="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-medium">100% 正文+素材+展开评论</span>
                </div>
                <p class="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  可直接粘贴笔记链接（支持换行批量粘贴），或在「笔记列表」中勾选多篇后一键深度采集：
                </p>

                <div class="mt-3 space-y-2">
                  <textarea
                    v-model="manualNoteInput"
                    rows="2"
                    placeholder="在此粘贴小红书笔记链接或笔记 ID（支持换行粘贴多条）..."
                    class="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-rose-400 focus:outline-none"
                  ></textarea>

                  <div class="flex items-center justify-between pt-1">
                    <button
                      :disabled="isCrawling || !manualNoteInput.trim()"
                      @click="startManualNotesDeepCrawl"
                      class="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50"
                    >
                      <Zap class="h-3.5 w-3.5" />
                      <span>开始深度采集输入的笔记</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- 场景 2：博主全量笔记与评论批量采集 -->
              <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <UserCheck class="h-4 w-4 text-rose-500" />
                    场景 2：指定博主全部笔记批量采集
                  </h3>
                  <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">博主全量资产归档</span>
                </div>
                <p class="text-[11px] text-slate-400 mt-0.5">
                  输入博主主页链接或 ID，全量游标翻页扫描博主全部历史作品
                </p>

                <div class="mt-3 space-y-2.5">
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-medium text-slate-600">博主 User ID / 主页链接</label>
                      <button
                        v-if="detectedUserId"
                        @click="targetUserId = detectedUserId"
                        class="text-[10px] text-rose-600 hover:underline"
                      >
                        填入当前博主 (ID: {{ detectedUserId.slice(-6) }})
                      </button>
                    </div>
                    <input
                      v-model="targetUserId"
                      placeholder="粘贴博主主页链接（如 https://www.xiaohongshu.com/user/profile/...）或 User ID..."
                      class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-rose-400 focus:outline-none"
                    />
                  </div>

                  <div class="flex items-center justify-between text-xs pt-1">
                    <label class="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                      <input type="checkbox" v-model="autoFetchComments" class="rounded text-rose-500" />
                      <span>同时递归展开每篇的全部评论</span>
                    </label>
                    <div class="flex items-center gap-1 text-[11px] text-slate-500">
                      <span>限制篇数:</span>
                      <input
                        type="number"
                        v-model.number="maxNotesLimit"
                        placeholder="不限"
                        class="w-14 rounded border border-slate-200 px-1 py-0.5 text-center text-xs"
                      />
                    </div>
                  </div>

                  <button
                    :disabled="isCrawling || !targetUserId"
                    @click="startBloggerCrawl"
                    class="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Play class="h-3.5 w-3.5" />
                    <span>开始全量采集该博主全部笔记</span>
                  </button>
                </div>
              </div>

              <!-- 运行中状态监控与实时心跳日志终端 (Live Terminal) -->
              <div v-if="isCrawling || liveLogs.length > 0" class="rounded-xl border border-slate-200 bg-slate-900 p-3.5 text-white space-y-2.5 font-mono">
                <div class="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                  <span class="flex items-center gap-2 text-emerald-400 font-bold">
                    <span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                    实时执行终端 (Live Terminal)
                  </span>
                  <div class="flex items-center gap-2">
                    <span v-if="cooldownSeconds > 0" class="text-amber-300 text-[11px] animate-pulse">
                      冷却中: {{ cooldownSeconds }}s
                    </span>
                    <button
                      v-if="isCrawling"
                      @click="stopCrawl"
                      class="rounded bg-rose-600/80 px-2 py-0.5 text-[10px] text-white hover:bg-rose-600"
                    >
                      中止并保存
                    </button>
                  </div>
                </div>

                <!-- 滚动日志窗口 -->
                <div class="max-h-48 overflow-y-auto space-y-1 text-[11px] leading-relaxed text-slate-300">
                  <div
                    v-for="(log, idx) in liveLogs"
                    :key="idx"
                    :class="[
                      log.includes('🎉') ? 'text-emerald-300 font-bold' : '',
                      log.includes('↳') ? 'text-blue-300' : '',
                      log.includes('⏳') ? 'text-amber-300' : '',
                      log.includes('⚠️') ? 'text-rose-300' : ''
                    ]"
                  >
                    {{ log }}
                  </div>
                </div>

                <div class="border-t border-slate-800 pt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <div class="flex items-center gap-1.5">
                    <span>已捕获笔记: {{ notes.length }} 篇</span>
                    <span>| 评论: {{ comments.length }} 条</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button
                      @click="handleCopyLogs"
                      class="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700 hover:text-white transition"
                      title="复制诊断日志到剪贴板"
                    >
                      {{ logCopied ? '已复制!' : '复制日志' }}
                    </button>
                    <button
                      @click="downloadLogsAsJson"
                      class="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700 hover:text-white transition"
                      title="下载排错日志 JSON 文件"
                    >
                      下载排错日志
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 2. 笔记列表 Tab (Notes - 包含场景 1 嗅探与场景 3 多选勾选) -->
          <template v-if="activeTab === 'notes'">
            <!-- 批量操作栏 (场景 3: 手动多选采集) -->
            <div v-if="notes.length > 0" class="flex items-center justify-between bg-slate-50 p-2 rounded-lg text-xs border border-slate-200/80">
              <div class="flex items-center gap-2">
                <label class="flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="isAllSelected"
                    @change="toggleSelectAll"
                    class="rounded text-rose-500 h-3.5 w-3.5"
                  />
                  <span>全选 (已选 {{ selectedNoteIds.size }} 篇)</span>
                </label>
              </div>

              <button
                :disabled="isCrawling || selectedNoteIds.size === 0"
                @click="startSelectedNotesDeepCrawl"
                class="flex items-center gap-1 rounded bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-40 transition"
              >
                <Zap class="h-3 w-3" />
                <span>深度采集选中的 {{ selectedNoteIds.size }} 篇</span>
              </button>
            </div>

            <div
              v-if="notes.length === 0"
              class="flex flex-col items-center justify-center py-16 text-center text-slate-400"
            >
              <Inbox class="h-10 w-10 text-slate-300 mb-2 stroke-[1.5]" />
              <p class="text-xs font-medium">暂无捕获笔记</p>
              <p class="text-[11px] text-slate-400 mt-1 max-w-[260px] leading-relaxed">
                • <b>场景 1</b>：在网页上正常滑动浏览，笔记将自动嗅探展示于此；<br />
                • <b>场景 3</b>：勾选列表里的笔记，可一键将选中的笔记升级为 100% 全深度采集。
              </p>
            </div>

            <div
              v-for="note in notes"
              :key="note.id"
              :class="[
                'group relative rounded-xl border p-3 shadow-xs transition',
                selectedNoteIds.has(note.id) ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200/80 bg-white hover:border-rose-200'
              ]"
            >
              <div class="flex gap-3 items-start">
                <!-- 场景 3 多选勾选框 -->
                <div class="pt-1">
                  <input
                    type="checkbox"
                    :checked="selectedNoteIds.has(note.id)"
                    @change="toggleSelectNote(note.id)"
                    class="rounded text-rose-500 h-4 w-4 cursor-pointer"
                  />
                </div>

                <!-- 封面缩略图 -->
                <div class="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-100">
                  <img
                    v-if="note.images.length > 0"
                    :src="note.images[0]"
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div
                    v-if="note.type === 'video'"
                    class="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white"
                  >
                    视频
                  </div>
                </div>

                <!-- 标题与详情 -->
                <div class="flex flex-1 flex-col justify-between overflow-hidden">
                  <div>
                    <h3 class="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-rose-600 transition" :title="note.title || note.desc">
                      {{ note.title || note.desc || '无标题笔记' }}
                    </h3>
                    <p class="text-[11px] text-slate-500 line-clamp-2 mt-0.5" :title="note.desc">
                      {{ note.desc }}
                    </p>
                  </div>

                  <div class="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span class="font-medium text-slate-600 flex items-center gap-1">
                      <span class="truncate max-w-[90px]">{{ note.author.name }}</span>
                      <span v-if="note.ipLocation" class="text-[10px] text-slate-400">({{ note.ipLocation }})</span>
                    </span>
                    <div class="flex items-center gap-2 text-slate-500">
                      <span class="flex items-center gap-0.5">
                        <Heart class="h-3 w-3 text-rose-400" />
                        {{ note.interactInfo.likedCount }}
                      </span>
                      <span class="flex items-center gap-0.5">
                        <Bookmark class="h-3 w-3 text-amber-400" />
                        {{ note.interactInfo.collectedCount }}
                      </span>
                      <span class="flex items-center gap-0.5">
                        <MessageSquare class="h-3 w-3 text-blue-400" />
                        {{ note.interactInfo.commentCount }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 快捷操作栏 -->
              <div class="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                <span class="text-slate-400">{{ note.dateStr }}</span>
                <div class="flex items-center gap-1.5">
                  <button
                    :disabled="isCrawling"
                    @click="startSingleNoteDeepCrawl(note.id, note.xsecToken)"
                    class="flex items-center gap-0.5 rounded bg-rose-50 px-2 py-0.5 text-rose-600 hover:bg-rose-100 font-medium transition"
                    title="将此篇升级为全深度采集"
                  >
                    <Zap class="h-3 w-3" />
                    深度采集此篇
                  </button>
                  <button
                    @click="handleDownloadMedia(note)"
                    class="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition"
                    title="下载无水印图片/视频"
                  >
                    <Download class="h-3 w-3" />
                    素材({{ note.images.length + (note.videoUrl ? 1 : 0) }})
                  </button>
                  <a
                    :href="note.url"
                    target="_blank"
                    class="flex items-center gap-0.5 text-slate-400 hover:text-rose-500 transition"
                  >
                    <ExternalLink class="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </template>

          <!-- 3. 评论列表 Tab (Comments) -->
          <template v-if="activeTab === 'comments'">
            <div
              v-if="comments.length === 0"
              class="flex flex-col items-center justify-center py-16 text-center text-slate-400"
            >
              <MessageSquare class="h-10 w-10 text-slate-300 mb-2 stroke-[1.5]" />
              <p class="text-xs font-medium">暂无捕获评论</p>
              <p class="text-[11px] text-slate-400 mt-1 max-w-[240px]">
                在笔记详情滑动，或在「深度采集」中一键展开所有折叠回复
              </p>
            </div>

            <div
              v-for="comment in comments"
              :key="comment.id"
              :class="[
                'rounded-xl border p-3 text-xs shadow-xs transition',
                comment.level === 2 ? 'ml-5 bg-slate-50/80 border-blue-200/60' : 'bg-white border-slate-200/90'
              ]"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <img
                    v-if="comment.author.avatar"
                    :src="comment.author.avatar"
                    class="h-5 w-5 rounded-full object-cover"
                  />
                  <span class="font-semibold text-slate-800">{{ comment.author.name }}</span>
                  <span
                    :class="[
                      'px-1.5 py-0.2 rounded text-[9px] font-bold',
                      comment.level === 2 ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                    ]"
                  >
                    {{ comment.level === 2 ? '↳ 折叠展开回复' : '★ 一级主评' }}
                  </span>
                  <span v-if="comment.targetUser" class="text-[10px] text-slate-500 font-medium">
                    回复 @{{ comment.targetUser.name }}
                  </span>
                </div>
                <span class="flex items-center gap-0.5 text-[11px] text-slate-400">
                  <Heart class="h-3 w-3 text-rose-400" />
                  {{ comment.likeCount }}
                </span>
              </div>
              <p class="mt-1.5 text-slate-700 leading-relaxed">{{ comment.content }}</p>
              <div class="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>{{ comment.dateStr }} ({{ comment.ipLocation || '未知属地' }})</span>
                <span v-if="comment.level === 1 && comment.subCommentCount > 0" class="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.2 rounded">
                  共 {{ comment.subCommentCount }} 条回复（已自动展开）
                </span>
              </div>
            </div>
          </template>

          <!-- 4. 人话版任务结算与诊断报告 Tab (Report) -->
          <template v-if="activeTab === 'report' && latestReport">
            <div class="space-y-4">
              <div class="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <FileCheck class="h-4 w-4 text-indigo-600" />
                    采集诊断与结算报告
                  </span>
                  <span class="text-[10px] font-mono text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                    总耗时: {{ latestReport.durationText }}
                  </span>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center">
                  <div class="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-xs">
                    <div class="text-base font-bold text-emerald-600">{{ latestReport.fullCount }} 篇</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">100% 完整抓取</div>
                  </div>
                  <div class="bg-white p-2.5 rounded-lg border border-amber-100 shadow-xs">
                    <div class="text-base font-bold text-amber-600">{{ latestReport.partialCount }} 篇</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">部分完成/自愈</div>
                  </div>
                  <div class="bg-white p-2.5 rounded-lg border border-rose-100 shadow-xs">
                    <div class="text-base font-bold text-rose-600">{{ latestReport.failedCount }} 篇</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">失败/已删除</div>
                  </div>
                </div>
                <div class="flex gap-2 pt-1">
                  <button
                    @click="activeTab = 'notes'"
                    class="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white border border-rose-200 p-2.5 text-xs font-bold text-rose-600 shadow-xs hover:bg-rose-50 transition"
                  >
                    <FileSpreadsheet class="h-4 w-4" />
                    <span>查看并导出笔记 ({{ notes.length }})</span>
                  </button>
                  <button
                    @click="activeTab = 'comments'"
                    class="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white border border-blue-200 p-2.5 text-xs font-bold text-blue-600 shadow-xs hover:bg-blue-50 transition"
                  >
                    <MessageSquare class="h-4 w-4" />
                    <span>查看并导出评论 ({{ comments.length }})</span>
                  </button>
                </div>
              </div>

              <!-- 逐篇明细 -->
              <div class="space-y-2">
                <h4 class="text-xs font-bold text-slate-800">各篇笔记抓取明细</h4>
                <div
                  v-for="item in latestReport.details"
                  :key="item.id"
                  class="rounded-xl border border-slate-200/80 bg-white p-3 space-y-1.5 shadow-xs"
                >
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-bold text-slate-800 truncate max-w-[280px]" :title="item.title">
                      {{ item.title }}
                    </span>
                    <span
                      :class="[
                        'px-2 py-0.5 rounded text-[10px] font-bold',
                        item.status === 'full' ? 'bg-emerald-100 text-emerald-800' :
                        item.status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      ]"
                    >
                      {{ item.status === 'full' ? '100% 完毕' : item.status === 'partial' ? '部分完成' : '失败' }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between text-[11px] text-slate-500">
                    <span>捕获评论: {{ item.commentCount }} 条</span>
                    <span class="font-mono text-[10px] text-slate-400">ID: {{ item.id.slice(-8) }}</span>
                  </div>
                  <div class="text-[11px] text-slate-600 bg-slate-50 p-2 rounded leading-snug">
                    <span class="font-medium text-slate-700">说明：</span>{{ item.reason }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 底部状态条 -->
        <div class="border-t border-slate-200/80 bg-slate-50/90 px-4 py-2 text-center text-[11px] text-slate-400 flex items-center justify-between">
          <span>总计捕获：{{ notes.length }} 篇笔记 / {{ comments.length }} 条评论</span>
          <span class="text-slate-300">|</span>
          <span class="text-emerald-600 font-medium flex items-center gap-1">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            原生 MAIN 核心就绪
          </span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  Sparkles,
  Flame,
  Trash2,
  X,
  FileSpreadsheet,
  Inbox,
  Heart,
  Bookmark,
  Download,
  ExternalLink,
  MessageSquare,
  Play,
  UserCheck,
  ShieldCheck,
  FileCheck,
  Zap,
  CheckSquare,
} from 'lucide-vue-next';
import type { XhsNote, XhsComment, SniffMessage, CrawlTaskSummaryReport } from '../types';
import { parseNotesPayload, parseCommentsPayload } from '../core/parser';
import { exportNotesToExcel, exportCommentsToExcel, downloadNoteMediaAsZip } from '../core/exporter';
import { crawlSingleNoteDeep, crawlBatchNotesDeep, crawlAllNotesForBlogger } from '../core/crawler';
import { downloadLogsAsJson, copyLogsToClipboard, recordLog } from '../core/logger';

const isOpen = ref(false);
const activeTab = ref<'notes' | 'comments' | 'automation' | 'report'>('notes');
const isExporting = ref(false);
const logCopied = ref(false);

// 自动化采集状态
const isCrawling = ref(false);
const isStopRequested = ref(false);
const liveLogs = ref<string[]>([]);
const cooldownSeconds = ref(0);
const latestReport = ref<CrawlTaskSummaryReport | null>(null);

// 任务参数与输入
const currentNoteId = ref('');
const currentNoteTitle = ref('');
const currentXsecToken = ref('');
const detectedUserId = ref('');
const targetUserId = ref('');
const manualNoteInput = ref('');
const autoFetchComments = ref(true);
const maxNotesLimit = ref<number | undefined>(undefined);

// 场景 3：多选选中集合
const selectedNoteIds = ref<Set<string>>(new Set());

// 数据池（Map去重）
const notesMap = ref<Map<string, XhsNote>>(new Map());
const commentsMap = ref<Map<string, XhsComment>>(new Map());

const notes = computed(() => Array.from(notesMap.value.values()));
const comments = computed(() => Array.from(commentsMap.value.values()));

const isAllSelected = computed(() => {
  return notes.value.length > 0 && selectedNoteIds.value.size === notes.value.length;
});

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedNoteIds.value.clear();
  } else {
    selectedNoteIds.value = new Set(notes.value.map((n) => n.id));
  }
}

function toggleSelectNote(id: string) {
  if (selectedNoteIds.value.has(id)) {
    selectedNoteIds.value.delete(id);
  } else {
    selectedNoteIds.value.add(id);
  }
  selectedNoteIds.value = new Set(selectedNoteIds.value);
}

function appendLog(text: string) {
  const time = new Date().toTimeString().slice(0, 8);
  liveLogs.value.unshift(`[${time}] ${text}`);
  if (liveLogs.value.length > 80) liveLogs.value.pop();
}

function checkCurrentUrlContext() {
  const url = window.location.href;

  // 1. 全局提取 URL 里的 xsec_token (无论是笔记详情还是博主主页)
  const tokenMatch = url.match(/xsec_token=([^&]+)/);
  if (tokenMatch) {
    currentXsecToken.value = decodeURIComponent(tokenMatch[1]);
  }

  // 2. 笔记详情页识别
  const noteMatch = url.match(/\/explore\/([a-f0-9]+)/i);
  if (noteMatch) {
    currentNoteId.value = noteMatch[1];
    const noteObj = notesMap.value.get(noteMatch[1]);
    if (noteObj) currentNoteTitle.value = noteObj.title;
  } else {
    currentNoteId.value = '';
    currentNoteTitle.value = '';
  }

  // 3. 博主个人主页识别
  const userMatch = url.match(/\/user\/profile\/([a-f0-9]+)/i);
  if (userMatch) {
    detectedUserId.value = userMatch[1];
    if (!targetUserId.value) {
      targetUserId.value = userMatch[1];
    }
  }
}

function handleCapturedMessage(event: MessageEvent) {
  const data = event.data as SniffMessage;
  if (!data || data.type !== 'XHS_DATA_CAPTURED') return;

  if (data.category === 'notes') {
    const parsedNotes = parseNotesPayload(data.data);
    if (parsedNotes.length > 0) {
      parsedNotes.forEach((n) => notesMap.value.set(n.id, n));
      notesMap.value = new Map(notesMap.value);
      checkCurrentUrlContext();
    }
  } else if (data.category === 'comments') {
    const parsedComments = parseCommentsPayload(data.data, currentNoteId.value);
    if (parsedComments.length > 0) {
      parsedComments.forEach((c) => commentsMap.value.set(c.id, c));
      commentsMap.value = new Map(commentsMap.value);
    }
  }
}

// 场景 3 执行：单篇笔记全深度采集
async function startSingleNoteDeepCrawl(noteId: string, xsecToken = '') {
  if (!noteId) return;

  isCrawling.value = true;
  isStopRequested.value = false;
  activeTab.value = 'automation';
  appendLog(`🎯 开始对笔记 [${noteId.slice(-6)}] 执行全深度采集 (正文+素材+全部展开评论)...`);

  try {
    const { note, comments: list, report } = await crawlSingleNoteDeep(
      noteId,
      xsecToken,
      (text) => appendLog(text),
      () => isStopRequested.value
    );

    if (note) {
      notesMap.value.set(note.id, note);
      notesMap.value = new Map(notesMap.value);
    }
    list.forEach((c) => commentsMap.value.set(c.id, c));
    commentsMap.value = new Map(commentsMap.value);

    latestReport.value = {
      taskId: 'TASK_' + Date.now(),
      startTime: new Date().toLocaleTimeString(),
      endTime: new Date().toLocaleTimeString(),
      durationText: '单篇深度提取',
      totalNotesTarget: 1,
      fullCount: report.status === 'full' ? 1 : 0,
      partialCount: report.status === 'partial' ? 1 : 0,
      failedCount: report.status === 'failed' ? 1 : 0,
      totalCommentsCaptured: list.length,
      details: [report],
    };

    activeTab.value = 'report';
    appendLog(`🎉 笔记深度采集完毕！已提取正文长文并捕获 ${list.length} 条评论（含所有展开回复）。`);
  } catch (err: any) {
    appendLog(`⚠️ 提取中断: ${err?.message || '异常'}`);
  } finally {
    isCrawling.value = false;
  }
}

// 场景 3 执行：手动粘贴多条笔记深度采集
async function startManualNotesDeepCrawl() {
  const lines = manualNoteInput.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return;

  const targetList: Array<{ id: string; xsecToken?: string }> = [];
  for (const line of lines) {
    const m = line.match(/\/explore\/([a-f0-9]+)/i);
    const tokenMatch = line.match(/xsec_token=([^&]+)/);
    const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : '';
    if (m) {
      targetList.push({ id: m[1], xsecToken: token });
    } else if (/^[a-f0-9]{24}$/i.test(line)) {
      targetList.push({ id: line, xsecToken: token });
    }
  }

  if (targetList.length === 0) {
    alert('未能识别到有效的笔记链接或 ID，请检查输入格式');
    return;
  }

  await runBatchDeepCrawl(targetList);
}

// 场景 3 执行：批量深度采集选中的笔记
async function startSelectedNotesDeepCrawl() {
  if (selectedNoteIds.value.size === 0) return;
  const targetList: Array<{ id: string; xsecToken?: string; title?: string }> = [];

  for (const id of selectedNoteIds.value) {
    const n = notesMap.value.get(id);
    targetList.push({
      id,
      xsecToken: n?.xsecToken || '',
      title: n?.title || id,
    });
  }

  await runBatchDeepCrawl(targetList);
}

async function runBatchDeepCrawl(targetList: Array<{ id: string; xsecToken?: string; title?: string }>) {
  isCrawling.value = true;
  isStopRequested.value = false;
  activeTab.value = 'automation';

  try {
    const result = await crawlBatchNotesDeep(
      targetList,
      {
        onLog: (t) => appendLog(t),
        onCountdown: (sec) => {
          cooldownSeconds.value = sec;
        },
        onNoteCaptured: (n) => {
          notesMap.value.set(n.id, n);
          notesMap.value = new Map(notesMap.value);
        },
        onCommentsCaptured: (cList) => {
          cList.forEach((c) => commentsMap.value.set(c.id, c));
          commentsMap.value = new Map(commentsMap.value);
        },
      },
      () => isStopRequested.value
    );

    latestReport.value = result.summaryReport;
    activeTab.value = 'report';
  } catch (err: any) {
    appendLog(`⚠️ 批量采集异常: ${err?.message || '网络中断'}`);
  } finally {
    isCrawling.value = false;
    cooldownSeconds.value = 0;
  }
}

// 场景 2 执行：博主全量采集
async function startBloggerCrawl() {
  if (!targetUserId.value) {
    alert('请输入博主 User ID 或主页链接');
    return;
  }

  let uid = targetUserId.value.trim();
  let token = currentXsecToken.value;

  // 如果输入框里粘贴的是带 xsec_token 的完整 URL，提取 token
  if (uid.includes('xsec_token=')) {
    const tm = uid.match(/xsec_token=([^&]+)/);
    if (tm) token = decodeURIComponent(tm[1]);
  }
  if (uid.includes('/user/profile/')) {
    const m = uid.match(/\/user\/profile\/([a-f0-9]+)/i);
    if (m) uid = m[1];
  }

  isCrawling.value = true;
  isStopRequested.value = false;
  activeTab.value = 'automation';
  appendLog(`开始对博主 [${uid.slice(-6)}] 发起全量扫描任务...`);

  try {
    const result = await crawlAllNotesForBlogger(
      uid,
      {
        xsecToken: token,
        maxNotes: maxNotesLimit.value,
        fetchComments: autoFetchComments.value,
        onLog: (text) => appendLog(text),
        onCountdown: (sec) => {
          cooldownSeconds.value = sec;
        },
        onNoteCaptured: (n) => {
          notesMap.value.set(n.id, n);
          notesMap.value = new Map(notesMap.value);
        },
        onCommentsCaptured: (cList) => {
          cList.forEach((c) => commentsMap.value.set(c.id, c));
          commentsMap.value = new Map(commentsMap.value);
        },
      },
      () => isStopRequested.value
    );

    latestReport.value = result.summaryReport;
    activeTab.value = 'report';
  } catch (err: any) {
    appendLog(`⚠️ 采集异常: ${err?.message || '网络中断'}`);
  } finally {
    isCrawling.value = false;
    cooldownSeconds.value = 0;
  }
}

function stopCrawl() {
  isStopRequested.value = true;
  appendLog('🛑 用户请求中止任务，正在安全结束并结算数据...');
}

async function handleExportNotes() {
  if (notes.value.length === 0) return;
  isExporting.value = true;
  try {
    await exportNotesToExcel(notes.value, '小天媒媒助手_小红书笔记');
  } finally {
    isExporting.value = false;
  }
}

async function handleExportComments() {
  if (comments.value.length === 0) return;
  isExporting.value = true;
  try {
    await exportCommentsToExcel(comments.value, '小天媒媒助手_小红书全量评论');
  } finally {
    isExporting.value = false;
  }
}

async function handleDownloadMedia(note: XhsNote) {
  try {
    await downloadNoteMediaAsZip(note);
  } catch (e) {
    alert('下载素材失败，请检查网络');
  }
}

function clearData() {
  notesMap.value.clear();
  commentsMap.value.clear();
  notesMap.value = new Map();
  commentsMap.value = new Map();
  selectedNoteIds.value.clear();
  liveLogs.value = [];
  latestReport.value = null;
}

async function handleCopyLogs() {
  const ok = await copyLogsToClipboard();
  if (ok) {
    logCopied.value = true;
    setTimeout(() => {
      logCopied.value = false;
    }, 2000);
  }
}

function handleDiagnosticMessage(event: MessageEvent) {
  const msg = event.data;
  if (!msg) return;
  if (msg.type === 'XHS_DIAGNOSTIC_LOG') {
    recordLog(msg.logType, msg.message, msg.detail);
  }
}

onMounted(() => {
  window.addEventListener('message', handleCapturedMessage);
  window.addEventListener('message', handleDiagnosticMessage);
  checkCurrentUrlContext();
  window.addEventListener('popstate', checkCurrentUrlContext);
});

onUnmounted(() => {
  window.removeEventListener('message', handleCapturedMessage);
  window.removeEventListener('message', handleDiagnosticMessage);
  window.removeEventListener('popstate', checkCurrentUrlContext);
});
</script>
