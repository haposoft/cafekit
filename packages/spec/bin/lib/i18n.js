/**
 * Installer i18n — English / 日本語 / Tiếng Việt.
 *
 * Covers every user-visible string: prompts, spinners, warnings, summary and
 * next steps. High-frequency internal debug logs stay English.
 *
 * Tone: concise, friendly, action-oriented. No ellipsis abuse (…); imperative
 * verbs; consistent capitalisation per language norms.
 */

const SUPPORTED = ['en', 'ja', 'vi'];

const LANGUAGE_LABELS = { en: 'English', ja: '日本語', vi: 'Tiếng Việt' };
const OTHER_LABEL = { en: 'Other...', ja: 'その他...', vi: 'Ngôn ngữ khác...' };

const MESSAGES = {
  // ─── English ───────────────────────────────────────────────────────────────
  en: {
    // Banner / lock / rollback
    reclaimed:       'Stale install lock reclaimed (previous process was gone).',
    lockHeld:        'Another install is already running (pid {pid}, started {since}).\n  If that process has ended, delete .cafekit.lock and try again.',
    installFailed:   'Installation failed: {reason}',
    rolledBack:      'Changes rolled back to the pre-install state.',
    rollbackFailed:  'Rollback failed: {reason}\n  Manual restore available at: {dir}',
    dryRunBanner:    'Dry-run — no files will be written.',

    // Language / platform selection
    selectLanguage:      'Select language',
    selectPlatform:      'Select platform(s) to install',
    allPlatforms:        'All platforms',
    confirmAllDetected:  'Found existing configs: {names}. Install for all?',
    defaultedToClaude:   'No existing config detected — defaulting to Claude Code.',
    cancelled:           'Installation cancelled.',

    // Mode banner
    modeForce:    'Mode: force-overwrite  •  user-modified files will be replaced (backup kept)',
    modeDryRun:   'Mode: dry-run  •  no changes will be written',
    modeInstall:  'Mode: install / update  •  your customisations are preserved',

    // Intro
    introDesc:    'AI-native development workflow',

    // Platform install spinner
    installingPlatform:    'Installing {name}',
    platformInstalled:     '{name} — {files} file(s), {skills} skill(s)',
    platformDryInstalled:  '{name} — {files} file(s), {skills} skill(s)  [dry-run]',

    // Addressing
    addressingQuestion:    'What should the AI call you?',
    addressingPlaceholder: 'e.g. boss, friend — Enter to skip',
    addressingSet:         '{name} will address you as "{addr}"',
    addressingInvalid:     'Letters only please — addressing skipped.',

    // Addressing update
    addressingUpdatePrompt: 'You are currently addressed as "{name}". Change it?',
    keepAddressingOption:  'Keep "{name}"',
    changeAddressingOption:'Change to something else',

    // Skills / deps setup
    skillDepsConfirm:      'Install skill dependencies? (Python venv, pip, npm, Chromium — takes a few minutes)',
    documentSkillsConfirm: 'Install optional document skills? (docs, DOCX, PDF, PPTX, XLSX, multimodal)',
    documentSkillsMetadataRecovery: 'Could not read {path}; preserving document skills to avoid destructive cleanup.',
    skillsSkipped:         'Skill dependencies skipped.\n  Run later: npx @haposoft/cafekit --with-skills-deps',

    venvCreating:          'Setting up Python environment',
    venvReady:             'Python environment ready',
    venvFailed:            'Could not create Python environment — check your Python 3 installation.',
    venvNoHost:            'Python 3 not found. Install it, then re-run with --with-skills-deps.',
    pipInstalling:         'Installing Python packages: {skill}',
    pipInstalled:          '{skill} — Python packages ready',
    pipFailed:             '{skill} — some packages failed. Retry:\n  {cmd}',
    npmInstalling:         'Installing Node packages: {skill}',
    npmInstalled:          '{skill} — Node packages ready',
    npmFailed:             '{skill} — npm install failed ({error}). Retry in: {dir}',
    playwrightInstalling:  'Downloading Playwright browser for {skill}',
    playwrightReady:       '{skill} — Playwright browser ready',
    playwrightSkipped:     '{skill} — Playwright browser download skipped',
    chromiumInstalling:    'Downloading Chromium for chrome-devtools',
    chromiumReady:         'Chromium ready',
    chromiumSkipped:       'Chromium download skipped — chrome-devtools will prompt on first use.',
    chromiumSystemChromeFound: 'System Chrome detected ({path}), skipping download',
    optionalToolsTitle:    'Optional tools to install manually',

    // Summary stats
    summaryTitle:    'Installation complete',
    summaryDryTitle: 'Dry-run preview',
    labelCopied:     'Installed',
    labelUpdated:    'Updated',
    labelUnchanged:  'Unchanged',
    labelPreserved:  'Preserved',
    labelSkills:     'Skills',
    labelVersion:    'CafeKit Version',
    labelMissing:    'Missing',
    labelErrors:     'Errors',
    yes:             'yes',
    no:              'no',
    preservedNote:   '{n} file(s) you edited were kept as-is.\n  Re-run with --force-overwrite to reset them (a backup is saved to .cafekit-backup/).',

    // Next steps
    nextStepsTitle:  'Next steps',
    nsClaude:        'Start coding: /cf:specs <feature>',
    nsCodex:         'Start with `$cf-specs <feature>`; review and trust project hooks with `/hooks`',
    nsKeys:          'Some skills need API keys: {skills}\n  Copy <skill>/.env.example → .env and fill in the values',
    nsForce:         'To force-refresh managed files: npx @haposoft/cafekit --force-overwrite',
    dryRunOnly:      'Dry-run complete — no files were changed.\n  Re-run without --dry-run to apply.',
    outroDone:       'Done!  docs: https://github.com/haposoft/cafekit',

    // Version check
    versionUpToDate:      'Already up to date ({v}). Use --force-overwrite to reinstall.',
    versionRefreshing:    'Refreshing CafeKit {v}; your modified files will be preserved.',
    versionDowngrade:     'Downgrading {from} → {to}. Features may be removed. Continue?',
    versionSamePrompt:    'CafeKit {v} is already installed. What would you like to do?',
    versionForceReinstall: 'Reinstalling CafeKit {v} (--force-overwrite)...',
    versionUpgradePrompt: 'CafeKit {from} → {to}: Update available!',
    updateOption:         'Update to {v}',
    refreshOption:        'Refresh managed files (preserve your edits)',
    reinstallOption:      'Reinstall (overwrite managed files)',
    reinstallCurrentOption: 'Reinstall {v}',
    skipOption:           'Skip (exit)',

    // Platform/language auto-skip when already installed
    installingFor:        'Installing for: {names}',
    grokCompatNotice:     'Grok CLI reads this install through its Claude compatibility. Trust the project first: run `grok --trust` or `/hooks-trust`, or its project hooks are skipped.',
    langKept:             'Language: {lang} (saved — skipping prompt)',
    platformKept:         'Platform: {names} (saved — skipping prompt)',

    // Add more platforms prompt (interactive, prior install exists)
    addPlatformsPrompt:   'Existing platforms: {names}. Add more?',

    // Version picker
    versionPickPrompt:    'Select CafeKit version to install:',
    versionPickCurrent:   '(installed)',
    versionPickLatest:    '(latest)',
    versionReexec:        'Switching to CafeKit {v}…',
    versionFetchFailed:   'Could not fetch version list. Using default menu.'
  },

  // ─── 日本語 ─────────────────────────────────────────────────────────────────
  ja: {
    reclaimed:       '前のプロセスが終了したため、ロックを解除しました。',
    lockHeld:        '別のインストールが実行中です（pid {pid}、開始: {since}）。\n  そのプロセスが終了している場合は .cafekit.lock を削除して再試行してください。',
    installFailed:   'インストールに失敗しました: {reason}',
    rolledBack:      'インストール前の状態に戻しました。',
    rollbackFailed:  'ロールバックに失敗しました: {reason}\n  手動復元可能: {dir}',
    dryRunBanner:    'ドライラン — ファイルへの書き込みは行いません。',

    selectLanguage:      '言語を選択してください',
    selectPlatform:      'インストールするプラットフォームを選択',
    allPlatforms:        'すべてのプラットフォーム',
    confirmAllDetected:  '既存の設定が見つかりました: {names}。すべてにインストールしますか？',
    defaultedToClaude:   '既存の設定が見つかりません — Claude Code をデフォルトで使用します。',
    cancelled:           'インストールをキャンセルしました。',

    modeForce:    'モード: 強制上書き  •  編集済みファイルを置換します（バックアップあり）',
    modeDryRun:   'モード: ドライラン  •  ファイルへの変更はありません',
    modeInstall:  'モード: インストール / 更新  •  カスタマイズは保持されます',

    // Intro
    introDesc:    'AI ネイティブ開発ワークフロー',

    installingPlatform:    '{name} をインストール中',
    platformInstalled:     '{name} — {files} ファイル、{skills} スキル',
    platformDryInstalled:  '{name} — {files} ファイル、{skills} スキル  [ドライラン]',

    addressingQuestion:    'AI にどう呼ばれたいですか？',
    addressingPlaceholder: '例: さん、くん — Enter でスキップ',
    addressingSet:         '{name} はあなたを「{addr}」とお呼びします',
    addressingInvalid:     '文字のみ入力できます — 呼称の設定をスキップしました。',

    // Addressing update
    addressingUpdatePrompt: '現在「{name}」と呼ばれています。変更しますか？',
    keepAddressingOption:  '「{name}」のまま',
    changeAddressingOption:'別の名前に変更',

    skillDepsConfirm:      'スキルの依存関係をインストールしますか？（Python venv、pip、npm、Chromium — 数分かかります）',
    documentSkillsConfirm: '任意のドキュメントスキルをインストールしますか？（docs、DOCX、PDF、PPTX、XLSX、multimodal）',
    documentSkillsMetadataRecovery: '{path} を読み取れないため、破壊的な削除を避けて document skills を保持します。',
    skillsSkipped:         'スキルの依存関係をスキップしました。\n  後で実行: npx @haposoft/cafekit --with-skills-deps',

    venvCreating:          'Python 環境を準備しています',
    venvReady:             'Python 環境の準備ができました',
    venvFailed:            'Python 環境を作成できませんでした — Python 3 のインストールを確認してください。',
    venvNoHost:            'Python 3 が見つかりません。インストール後、--with-skills-deps で再実行してください。',
    pipInstalling:         'Python パッケージをインストール中: {skill}',
    pipInstalled:          '{skill} — Python パッケージの準備ができました',
    pipFailed:             '{skill} — 一部のパッケージが失敗しました。再試行:\n  {cmd}',
    npmInstalling:         'Node パッケージをインストール中: {skill}',
    npmInstalled:          '{skill} — Node パッケージの準備ができました',
    npmFailed:             '{skill} — npm install に失敗しました ({error})。{dir} で手動再試行してください。',
    playwrightInstalling:  '{skill} 用の Playwright ブラウザをダウンロード中',
    playwrightReady:       '{skill} — Playwright ブラウザの準備ができました',
    playwrightSkipped:     '{skill} — Playwright ブラウザのダウンロードをスキップしました',
    chromiumInstalling:    'chrome-devtools 用 Chromium をダウンロード中',
    chromiumReady:         'Chromium の準備ができました',
    chromiumSkipped:       'Chromium のダウンロードをスキップ — 初回使用時に chrome-devtools が自動取得します。',
    chromiumSystemChromeFound: 'システムChromeを検出 ({path})、ダウンロードをスキップします',
    optionalToolsTitle:    '手動でインストールが必要なオプションツール',

    summaryTitle:    'インストール完了',
    summaryDryTitle: 'ドライラン プレビュー',
    labelCopied:     'インストール',
    labelUpdated:    '更新',
    labelUnchanged:  '変更なし',
    labelPreserved:  '保持',
    labelSkills:     'スキル',
    labelVersion:    'CafeKit Version',
    labelMissing:    '不足',
    labelErrors:     'エラー',
    yes:             'はい',
    no:              'いいえ',
    preservedNote:   '編集済みファイル {n} 件はそのままにしました。\n  --force-overwrite で再実行するとリセットできます（.cafekit-backup/ にバックアップ保存）。',

    nextStepsTitle:  '次のステップ',
    nsClaude:        'コーディング開始: /cf:specs <機能名>',
    nsCodex:         '`$cf-specs <機能名>` で開始し、`/hooks` でプロジェクトフックを確認・信頼',
    nsKeys:          '一部のスキルに API キーが必要です: {skills}\n  <skill>/.env.example を .env にコピーし、値を入力してください',
    nsForce:         '管理ファイルを強制更新: npx @haposoft/cafekit --force-overwrite',
    dryRunOnly:      'ドライラン完了 — ファイルへの変更はありませんでした。\n  変更を適用するには --dry-run なしで再実行してください。',
    outroDone:       '完了！  ドキュメント: https://github.com/haposoft/cafekit',

    versionUpToDate:      '最新バージョンです（{v}）。再インストールするには --force-overwrite を使用してください。',
    versionRefreshing:    'CafeKit {v} を更新します。編集済みファイルは保持されます。',
    versionDowngrade:     '{from} → {to} へのダウングレードです。機能が削除される可能性があります。続けますか？',
    versionSamePrompt:    'CafeKit {v} は既にインストールされています。何をしますか？',
    versionForceReinstall: 'CafeKit {v} を再インストール中 (--force-overwrite)...',
    versionUpgradePrompt: 'CafeKit {from} → {to}: アップデートが利用可能です！',
    updateOption:         '{v} にアップデート',
    refreshOption:        '管理対象ファイルを更新（編集内容を保持）',
    reinstallOption:      '再インストール（管理対象ファイルを上書き）',
    reinstallCurrentOption: '{v} を再インストール',
    skipOption:           'スキップ（終了）',

    // Platform/language auto-skip when already installed
    installingFor:        'インストール先: {names}',
    grokCompatNotice:     'Grok CLI はこのインストールを Claude 互換として読み込みます。先にプロジェクトを信頼してください: `grok --trust` または `/hooks-trust`。信頼しないとプロジェクトフックはスキップされます。',
    langKept:             '言語: {lang} (保存済み — スキップ)',
    platformKept:         'プラットフォーム: {names} (保存済み — スキップ)',

    // Add more platforms prompt (interactive, prior install exists)
    addPlatformsPrompt:   '既存プラットフォーム: {names}。さらに追加しますか？',

    // Version picker
    versionPickPrompt:    'インストールする CafeKit バージョンを選択:',
    versionPickCurrent:   '(インストール済み)',
    versionPickLatest:    '(最新)',
    versionReexec:        'CafeKit {v} に切り替えます…',
    versionFetchFailed:   'バージョン一覧を取得できませんでした。デフォルトメニューを表示します。'
  },

  // ─── Tiếng Việt ─────────────────────────────────────────────────────────────
  vi: {
    reclaimed:       'Khóa cài đặt cũ đã được thu hồi (tiến trình trước đã kết thúc).',
    lockHeld:        'Có một phiên cài đặt khác đang chạy (pid {pid}, bắt đầu: {since}).\n  Nếu tiến trình đó đã kết thúc, hãy xóa .cafekit.lock rồi thử lại.',
    installFailed:   'Cài đặt thất bại: {reason}',
    rolledBack:      'Đã hoàn tác về trạng thái trước khi cài đặt.',
    rollbackFailed:  'Hoàn tác thất bại: {reason}\n  Bản sao lưu thủ công: {dir}',
    dryRunBanner:    'Dry-run — sẽ không có tệp nào được ghi.',

    selectLanguage:      'Chọn ngôn ngữ',
    selectPlatform:      'Chọn (các) nền tảng cần cài',
    allPlatforms:        'Tất cả nền tảng',
    confirmAllDetected:  'Phát hiện cấu hình sẵn: {names}. Cài cho tất cả?',
    defaultedToClaude:   'Không tìm thấy cấu hình sẵn — mặc định dùng Claude Code.',
    cancelled:           'Đã hủy cài đặt.',

    modeForce:    'Chế độ: ghi đè  •  file bạn đã sửa sẽ bị thay (có bản sao lưu)',
    modeDryRun:   'Chế độ: dry-run  •  sẽ không thay đổi bất kỳ tệp nào',
    modeInstall:  'Chế độ: cài / cập nhật  •  nội dung bạn tuỳ chỉnh được giữ nguyên',

    // Intro
    introDesc:    'Quy trình phát triển AI-native',

    installingPlatform:    'Đang cài {name}',
    platformInstalled:     '{name} — {files} tệp, {skills} skill',
    platformDryInstalled:  '{name} — {files} tệp, {skills} skill  [dry-run]',

    addressingQuestion:    'Bạn muốn AI gọi bạn là gì?',
    addressingPlaceholder: 'vd: sếp, đại ca — Enter để bỏ qua',
    addressingSet:         '{name} sẽ gọi bạn là "{addr}"',
    addressingInvalid:     'Chỉ nhập chữ cái — bỏ qua thiết lập xưng hô.',

    // Addressing update
    addressingUpdatePrompt: 'Bạn đang được gọi là "{name}". Bạn có muốn đổi không?',
    keepAddressingOption:  'Giữ "{name}"',
    changeAddressingOption:'Đổi tên khác',

    skillDepsConfirm:      'Cài dependencies cho skill ngay? (Python venv, pip, npm, Chromium — mất vài phút)',
    documentSkillsConfirm: 'Cài thêm nhóm skill tài liệu? (docs, DOCX, PDF, PPTX, XLSX, multimodal)',
    documentSkillsMetadataRecovery: 'Không đọc được {path}; giữ nguyên skill tài liệu để tránh dọn nhầm dữ liệu.',
    skillsSkipped:         'Đã bỏ qua dependencies skill.\n  Cài sau bằng lệnh: npx @haposoft/cafekit --with-skills-deps',

    venvCreating:          'Đang thiết lập môi trường Python',
    venvReady:             'Môi trường Python đã sẵn sàng',
    venvFailed:            'Không thể tạo môi trường Python — hãy kiểm tra cài đặt Python 3.',
    venvNoHost:            'Không tìm thấy Python 3. Hãy cài Python 3 rồi chạy lại với --with-skills-deps.',
    pipInstalling:         'Đang cài gói Python: {skill}',
    pipInstalled:          '{skill} — gói Python đã sẵn sàng',
    pipFailed:             '{skill} — một số gói cài thất bại. Chạy lại thủ công:\n  {cmd}',
    npmInstalling:         'Đang cài gói Node: {skill}',
    npmInstalled:          '{skill} — gói Node đã sẵn sàng',
    npmFailed:             '{skill} — npm install thất bại ({error}). Hãy thử lại trong: {dir}',
    playwrightInstalling:  'Đang tải Playwright browser cho {skill}',
    playwrightReady:       '{skill} — Playwright browser đã sẵn sàng',
    playwrightSkipped:     '{skill} — đã bỏ qua tải Playwright browser',
    chromiumInstalling:    'Đang tải Chromium cho chrome-devtools',
    chromiumReady:         'Chromium đã sẵn sàng',
    chromiumSkipped:       'Bỏ qua tải Chromium — chrome-devtools sẽ tự tải khi dùng lần đầu.',
    chromiumSystemChromeFound: 'Đã phát hiện Chrome hệ thống ({path}), bỏ qua tải Chromium',
    optionalToolsTitle:    'Công cụ tuỳ chọn cần cài thủ công',

    summaryTitle:    'Cài đặt hoàn tất',
    summaryDryTitle: 'Xem trước dry-run',
    labelCopied:     'Đã cài',
    labelUpdated:    'Đã cập nhật',
    labelUnchanged:  'Không đổi',
    labelPreserved:  'Đã giữ',
    labelSkills:     'Skill',
    labelVersion:    'CafeKit Version',
    labelMissing:    'Thiếu',
    labelErrors:     'Lỗi',
    yes:             'có',
    no:              'không',
    preservedNote:   '{n} tệp bạn đã chỉnh sửa được giữ nguyên.\n  Chạy lại với --force-overwrite để cài đè (bản sao lưu ở .cafekit-backup/).',

    nextStepsTitle:  'Bước tiếp theo',
    nsClaude:        'Bắt đầu code: /cf:specs <mô-tả-tính-năng>',
    nsCodex:         'Bắt đầu bằng `$cf-specs <tính-năng>`; kiểm tra và trust project hooks bằng `/hooks`',
    nsKeys:          'Một số skill cần API key: {skills}\n  Sao chép <skill>/.env.example → .env rồi điền giá trị',
    nsForce:         'Làm mới file được quản lý: npx @haposoft/cafekit --force-overwrite',
    dryRunOnly:      'Dry-run hoàn tất — không có tệp nào thay đổi.\n  Chạy lại không có --dry-run để áp dụng.',
    outroDone:       'Xong!  Tài liệu: https://github.com/haposoft/cafekit',

    versionUpToDate:      'Đã là phiên bản mới nhất ({v}). Dùng --force-overwrite để cài lại.',
    versionRefreshing:    'Đang làm mới CafeKit {v}; các tệp bạn đã sửa sẽ được giữ nguyên.',
    versionDowngrade:     'Đang hạ cấp {from} → {to}. Một số tính năng có thể bị xoá. Tiếp tục?',
    versionSamePrompt:    'CafeKit {v} đã được cài đặt. Bạn muốn làm gì?',
    versionForceReinstall: 'Đang cài lại CafeKit {v} (--force-overwrite)...',
    versionUpgradePrompt: 'CafeKit {from} → {to}: Có bản cập nhật mới!',
    updateOption:         'Cập nhật lên {v}',
    refreshOption:        'Làm mới file được quản lý (giữ phần bạn đã sửa)',
    reinstallOption:      'Cài lại (ghi đè file được quản lý)',
    reinstallCurrentOption: 'Cài lại {v}',
    skipOption:           'Bỏ qua (thoát)',

    // Platform/language auto-skip when already installed
    installingFor:        'Cài cho: {names}',
    grokCompatNotice:     'Grok CLI đọc bản cài này qua lớp tương thích Claude. Hãy trust project trước: chạy `grok --trust` hoặc `/hooks-trust`, nếu không project hooks sẽ bị bỏ qua.',
    langKept:             'Ngôn ngữ: {lang} (đã lưu — bỏ qua chọn lại)',
    platformKept:         'Nền tảng: {names} (đã lưu — bỏ qua chọn lại)',

    // Add more platforms prompt (interactive, prior install exists)
    addPlatformsPrompt:   'Nền tảng hiện có: {names}. Thêm nền tảng khác?',

    // Version picker
    versionPickPrompt:    'Chọn phiên bản CafeKit để cài:',
    versionPickCurrent:   '(đang cài)',
    versionPickLatest:    '(mới nhất)',
    versionReexec:        'Đang chuyển sang cài CafeKit {v}…',
    versionFetchFailed:   'Không lấy được danh sách phiên bản. Dùng menu mặc định.'
  }
};

/** Normalize a language code to a supported one; unknown → 'en'. */
function resolveLang(code) {
  if (!code) return 'en';
  const lc = String(code).toLowerCase().slice(0, 2);
  return SUPPORTED.includes(lc) ? lc : 'en';
}

/** Build a translator. Falls back to English per-key, then the key itself. */
function createTranslator(lang) {
  const resolved = resolveLang(lang);
  return function t(key, vars = {}) {
    const template = (MESSAGES[resolved] && MESSAGES[resolved][key]) || MESSAGES.en[key] || key;
    return template.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? String(vars[name]) : `{${name}}`));
  };
}

module.exports = { SUPPORTED, LANGUAGE_LABELS, OTHER_LABEL, MESSAGES, resolveLang, createTranslator };
