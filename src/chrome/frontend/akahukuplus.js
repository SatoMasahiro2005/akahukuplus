'use strict';

/*
 * akahukuplus
 *
 * @author akahuku@gmail.com
 */

if (document.querySelector('meta[name="generator"][content="akahukuplus"]')) {
	console.log('akahukuplus: multiple execution of content script.');
	location.reload();
}
else {

/*
 * consts
 */

const APP_NAME = 'akahukuplus';
const IS_GECKO = 'InstallTrigger' in window;
const FUTABA_CHARSET = 'Shift_JIS';
const NOTFOUND_TITLE = /404\s+file\s+not\s+found/i;
const UNAVAILABLE_TITLE = /503 Service Temporarily Unavailable/;
const WAIT_AFTER_RELOAD = 500;
const WAIT_AFTER_POST = 500;
const LEAD_REPLIES_COUNT = 50;
const REST_REPLIES_PROCESS_COUNT = 50;
const REST_REPLIES_PROCESS_INTERVAL = 100;
const POSTFORM_DEACTIVATE_DELAY = 500;
const POSTFORM_LOCK_RELEASE_DELAY = 1000;
const RELOAD_LOCK_RELEASE_DELAY = 1000 * 3;
const RELOAD_AUTO_SCROLL_CONSUME = 300;
const NETWORK_ACCESS_MIN_INTERVAL = 1000 * 3;
const QUOTE_POPUP_DELAY_MSEC = 1000 * 0.5;
const QUOTE_POPUP_HIGHLIGHT_MSEC = 1000 * 2;
const QUOTE_POPUP_HIGHLIGHT_TOP_MARGIN = 64;
const QUOTE_POPUP_POS_OFFSET = 8;
const CATALOG_ANCHOR_PADDING = 5 * 2;
const CATALOG_ANCHOR_MARGIN = 2;
const CATALOG_THUMB_WIDTH = 50;
const CATALOG_THUMB_HEIGHT = 50;
const CATALOG_LONG_CLASS_THRESHOLD = 100;
const CATALOG_EXPIRE_WARN_RATIO = 0.95;
const CATALOG_TEXT_MAX_LENGTH = 100;
const CATALOG_COOKIE_LIFE_DAYS = 100;
const CATALOG_POPUP_DELAY = 500;
const CATALOG_POPUP_TEXT_WIDTH = 150;
const CATALOG_POPUP_THUMBNAIL_ZOOM_FACTOR = 3;
const FALLBACK_LAST_MODIFIED = 'Fri, 01 Jan 2010 00:00:00 GMT';
const HEADER_MARGIN_BOTTOM = 16;
const FALLBACK_JPEG_QUALITY = 0.8;
const TEGAKI_CANVAS_WIDTH = 344;// original size: 344
const TEGAKI_CANVAS_HEIGHT = 135;// original size: 135
const INLINE_VIDEO_MAX_WIDTH = '720px';
const INLINE_VIDEO_MAX_HEIGHT = '75vh';
const QUICK_MODERATE_REASON_CODE = 110;
const EXTRACT_UNIT = 10;
const ASSET_FILE_SYSTEM_NAME = 'asset';
const THREAD_FILE_SYSTEM_NAME = 'thread';

const DEBUG_ALWAYS_LOAD_XSL = false;		// default: false
const DEBUG_DUMP_INTERNAL_XML = false;		// default: false
const DEBUG_IGNORE_LAST_MODIFIED = false;	// default: false

/*
 * <<<1 globals
 */

// object instances, created on demand
let timingLogger = stub('timingLogger', () => timingLogger = createTimingLogger());
let storage = stub('storage', () => storage = createPersistentStorage());
let backend = stub('backend', () => backend = createExtensionBackend());
let transport = stub('transport', () => transport = createTransport());
let resources = stub('resources', () => resources = createResourceManager());
let postStats = stub('postStats', () => postStats = createPostStats());
let urlStorage = stub('urlStorage', () => urlStorage = createUrlStorage());
let xmlGenerator = stub('xmlGenerator', () => xmlGenerator = createXMLGenerator());
let linkifier = stub('linkifier', () => linkifier = createLinkifier());
let passiveTracker = stub('passiveTracker', () => passiveTracker = createPassiveTracker());
let activeTracker = stub('activeTracker', () => activeTracker = createActiveTracker());
let clickDispatcher = stub('clickDispatcher', () => clickDispatcher = createClickDispatcher());
let keyManager = stub('keyManager', () => keyManager = createKeyManager());
let favicon = stub('favicon', () => favicon = createFavicon());
let scrollManager = stub('scrollManager', () => scrollManager = createScrollManager(10));
let selectionMenu = stub('selectionMenu', () => selectionMenu = createSelectionMenu());
let catalogPopup = stub('catalogPopup', () => catalogPopup = createCatalogPopup($qs('#catalog')));
let quotePopup = stub('quotePopup', () => quotePopup = createQuotePopup());
let titleIndicator = stub('titleIndicator', () => titleIndicator = createTitleIndicator());
let resourceSaver = stub('resourceSaver', () => resourceSaver = createResourceSaver());
let moderator = stub('moderator', () => moderator = createModerator());
let historyStateWrapper = stub('historyStateWrapper', () => historyStateWrapper = createHistoryStateWrapper());

// variables with initial values
let bootVars = {bodyHTML: ''};
let version = '0.0.1';
let devMode = false;
const siteInfo = {
	server: '', board: '', resno: 0, date: null,
	summaryIndex: 0,	// only summary mode
	latestNumber: 0,	// only summary mode
	logSize: 10000,
	maxAttachSize: 0,
	maxReplies: -1,
	minThreadLifeTime: 0,
	lastModified: 0,
	subHash: {},
	nameHash: {},
	notice: '',
	idDisplay: false
};
const cursorPos = {
	x: 0,
	y: 0,
	pagex: 0,
	pagey: 0,
	moved: false
};
const reloadStatus = {
	lastReloaded: Date.now(),
	lastReloadType: '',
	lastReceivedText: '',
	lastRepliesCount: 0,
	lastReceivedBytes: 0,
	lastReceivedCompressedBytes: 0,
	lastStatus: 0,
	totalReceivedBytes: 0,
	totalReceivedCompressedBytes: 0,
	size: function (key) {return getReadableSize(this[key])}
};
const pageModes = [];
const appStates = ['command'];
const globalPromises = {};

// variables to be initialized at appropriate time
let xsltProcessor;
let viewportRect;
let overrideUpfile;
let sounds;
let editorHelper;

/*
 * <<<1 bootstrap functions
 */

let styleInitializer = (() => {
	const STYLE_ID = 'akahuku_initial_style';

	function start () {
		let s = document.getElementById(STYLE_ID);

		if (!s) {
			try {
				s = document.documentElement.appendChild(document.createElement('style'));
			}
			catch (e) {
				s = null;
			}
		}

		if (s) {
			s.type = 'text/css';
			s.id = 'akahuku_initial_style';
			s.appendChild(document.createTextNode('body {visibility:hidden}'));
		}
	}

	function done () {
		let s = document.getElementById(STYLE_ID);

		if (s) {
			s.parentNode.removeChild(s);
		}
	}

	start();

	return {done};
})();

let scriptWatcher = (() => {
	function handleBeforeScriptExecute (e) {
		e.preventDefault();
	}

	const result = new MutationObserver(ms => {
		ms.forEach(m => {
			m.addedNodes.forEach(node => {
				if (node.nodeType != 1 || node.nodeName != 'SCRIPT') return;
				node.type = 'text/plain';
				node.addEventListener(
					'beforescriptexecute', handleBeforeScriptExecute, {once: true});
			});
		});
	});

	result.observe(document.documentElement, {
		childList: true,
		subtree: true
	});

	return result;
})();

// html extension to DOMParser: @see https://gist.github.com/kethinov/4760460
(DOMParser => {
	const DOMParser_proto = DOMParser.prototype,
		real_parseFromString = DOMParser_proto.parseFromString;

	// Firefox/Opera/IE throw errors on unsupported types
	try {
		// WebKit returns null on unsupported types
		if ((new DOMParser).parseFromString('', 'text/html')) {
			// text/html parsing is natively supported
			return;
		}
	} catch (ex) {}

	DOMParser_proto.parseFromString = function(markup, type) {
		if (/^\s*text\/html\s*(?:;|$)/i.test(type)) {
			const doc = document.implementation.createHTMLDocument('');
			if (/<!doctype/i.test(markup)) {
				doc.documentElement.innerHTML = markup;
			}
			else {
				doc.body.innerHTML = markup;
			}
			return doc;
		}
		else {
			return real_parseFromString.apply(this, arguments);
		}
	};
})(window.DOMParser);

function stub (label, creator) {
	return new Proxy({}, {
		get: (obj, prop) => {
			//console.log(`stub: ${label}.${prop} proxy getter invoked`);
			return creator()[prop];
		}
	});
}

function transformWholeDocument (xsl) {
	timingLogger.startTag('transformWholeDocument');

	const generateResult = xmlGenerator.run(
		bootVars.bodyHTML,
		pageModes[0].mode == 'reply' ? LEAD_REPLIES_COUNT : null);

	try {
		timingLogger.startTag('parsing xsl');
		xsl = (new window.DOMParser()).parseFromString(xsl, "text/xml");
		timingLogger.endTag();
	}
	catch (e) {
		console.error(`${APP_NAME}: transformWholeDocument: ${e.stack}`);
		throw new Error(
			`${APP_NAME}: XSL ファイルの DOM ツリー構築に失敗しました。中止します。`);
	}

	xsltProcessor = new XSLTProcessor;
	try {
		timingLogger.startTag('constructing xsl');
		xsltProcessor.importStylesheet(xsl);
		timingLogger.endTag();
	}
	catch (e) {
		console.error(`${APP_NAME}: transformWholeDocument: ${e.stack}`);
		throw new Error(
			`${APP_NAME}: XSL ファイルの評価に失敗しました。中止します。`);
	}

	// transform xsl into html
	timingLogger.startTag('applying xsl');
	document.body.innerHTML = '';
	xsltProcessor.setParameter(null, 'app_name', APP_NAME);
	xsltProcessor.setParameter(null, 'dev_mode', devMode ? '1' : '0');
	xsltProcessor.setParameter(null, 'page_mode', pageModes[0].mode);
	xsltProcessor.setParameter(null, 'render_mode', 'full');
	xsltProcessor.setParameter(null, 'platform', IS_GECKO ? 'moz' : 'chrome');
	xsltProcessor.setParameter(null, 'sort_order', storage.runtime.catalog.sortOrder);

	let fragment = xsltProcessor.transformToFragment(generateResult.xml, document);
	if (!fragment) {
		throw new Error(
			`${APP_NAME}: XML 文書を変換できませんでした。中止します。`);
	}

	const head = $qs('head', fragment);
	const body = $qs('body', fragment);
	const removeHeadElements = () => {
		$qsa('head > *').forEach(node => {
			if (node.nodeName == 'BASE') return;
			node.parentNode.removeChild(node);
		});
	};

	/*
	 * transform result has head or body:
	 *
	 *  #fragment
	 *    head
	 *      meta
	 *      meta
	 *       :
	 *    body
	 *      header
	 */

	if (head || body) {
		if (head) {
			removeHeadElements();
			document.head.appendChild(fixFragment(fragment, 'head'));
		}
		if (body) {
			document.body.appendChild(fixFragment(fragment, 'body'));
		}
	}

	/*
	 * transform result has not head and body:
	 *
	 *  #fragment
	 *    meta
	 *    meta
	 *     :
	 *    header
	 */

	else {
		removeHeadElements();
		document.body.appendChild(fragment);
	}

	// expand all markups of all ads
	extractDisableOutputEscapingTags(document.documentElement);

	timingLogger.endTag();

	timingLogger.startTag('some tweaks');
	// some tweaks: ensure html tag language
	document.documentElement.setAttribute('lang', 'ja');

	// some tweaks: remove obsolete attributes on body element
	['bgcolor', 'text', 'link', 'vlink', 'alink'].forEach(p => {
		document.body.removeAttribute(p);
	});

	// some tweaks: move some elements to its proper position
	const headNodes = Array.from($qsa('meta,title,link,style'.replace(/^|,/g, '$&body ')));
	while (headNodes.length) {
		const node = headNodes.shift();
		node.parentNode.removeChild(node);
		document.head.appendChild(node);
	}

	// some tweaks: ensure title element exists
	if (document.head.getElementsByTagName('title').length == 0) {
		document.head.appendChild(document.createElement('title')).setAttribute(
			'data-binding', 'xpath:/futaba/meta/title');
	}
	timingLogger.endTag();

	// expand all bindings
	timingLogger.startTag('applying bindings');
	applyDataBindings(generateResult.xml);
	timingLogger.endTag();

	if (DEBUG_DUMP_INTERNAL_XML) {
		dumpDebugText(serializeXML(generateResult.xml));
	}

	fragment = xsl = null;
	//bootVars = null;

	$('content').classList.remove('init');

	timingLogger.startTag('install');
	install(pageModes[0].mode);
	timingLogger.forceEndTag();
	timingLogger.locked = true;

	processRemainingReplies(null, generateResult.remainingRepliesContext);
}

function install (mode) {
	/*
	 * last modified date
	 */

	try {
		siteInfo.lastModified = new Date(document.lastModified).toUTCString();
	}
	catch (e) {
		siteInfo.lastModified = 0;
	}

	/*
	 * message handler from backend
	 */

	backend.setMessageListener((data, sender, response) => {
		switch (data.type) {
		case 'notify-viewers':
			{
				if (data.siteInfo.server == siteInfo.server
				&&  data.siteInfo.board == siteInfo.board
				&&  data.siteInfo.resno != siteInfo.resno) {
					$t('viewers', data.data);
				}
			}
			break;

		case 'query-filesystem-permission':
			devMode && console.log(`got message: ${data.type}`);
			resourceSaver.fileSystemManager.get(data.id).then(fileSystem => {
				return fileSystem.queryRootDirectoryPermission(true);
			})
			.then(permission => {
				devMode && console.log(`returning response (${permission})`);
				response({permission});
			});
			return true;

		case 'get-filesystem-permission':
			devMode && console.log(`got message: ${data.type}`);
			resourceSaver.fileSystemManager.get(data.id).then(fileSystem => {
				return fileSystem.getRootDirectory(true);
			})
			.then(result => {
				devMode && console.log(`returning response (${!!result.handle})`);
				response({granted: !!result.handle});
			});
			return true;
		}
	});

	/*
	 * and register click handlers
	 */

	clickDispatcher.ensure;
	clickDispatcher
		.add('#void', () => {})

		.add('#delete-post',       commands.openDeleteDialog)
		.add('#config',            commands.openConfigDialog)
		.add('#help',              commands.openHelpDialog)
		.add('#draw',              commands.openDrawDialog)
		.add('#toggle-panel',      commands.togglePanelVisibility)
		.add('#reload',            commands.reload)
		.add('#sage',              commands.toggleSage)
		.add('#search-start',      commands.search)
		.add('#clear-upfile',      commands.clearUpfile)
		.add('#toggle-catalog',    commands.toggleCatalogVisibility)
		.add('#autotrack',         commands.registerAutotrack)
		.add('#autosave',          commands.registerAutosave)
		.add('#reload-ext',        commands.reloadExtension)
		.add('#prev-summary',      commands.summaryBack)
		.add('#next-summary',      commands.summaryNext)
		.add('#clear-credentials', commands.clearCredentials)

		.add('#search-item', (e, t) => {
			const number = t.getAttribute('data-number');
			if (!number) return;
			let wrapper = $qs([
				`article .topic-wrap[data-number="${number}"]`,
				`article .reply-wrap > [data-number="${number}"]`
			].join(','));
			if (!wrapper) return;

			const rect = wrapper.getBoundingClientRect();
			if (rect.top < 0 || rect.bottom >= viewportRect.height) {
				window.scrollTo(
					0,
					Math.floor(
						docScrollTop() +
						rect.top +
						(rect.height / 2) -
						(viewportRect.height / 2)));
			}
			wrapper.classList.add('hilight');
			setTimeout(() => {
				wrapper.classList.remove('hilight');
				wrapper = null;
			}, 1000);
		})
		.add('#save-catalog-settings', (e, t) => {
			commands.updateCatalogSettings({
				x: $('catalog-horz-number').value,
				y: $('catalog-vert-number').value,
				text: $('catalog-with-text').checked ? storage.config.catalog_text_max_length.value : 0
			});
			alert('はい。');
		})

		.add('.del', (e, t) => {
			if (storage.config.quick_moderation.value) {
				commands.quickModerate(e, t);
			}
			else {
				commands.openModerateDialog(e, t);
			}
		})
		.add('.postno', (e, t) => {
			const wrap = getWrapElement(t);
			if (!wrap) return;
			let comment = $qs('.comment', wrap);
			if (!comment) return;

			comment = commentToString(comment);

			if ($qs('.reply-image', wrap) && /^ｷﾀ━+\(ﾟ∀ﾟ\)━+\s*!+$/.test(comment)) {
				comment = $qs('.postno', wrap).textContent;
			}

			selectionMenu.dispatch('quote', comment);
		})
		.add('.save-image',  (e, t) => {
			commands.saveAsset(t);
		})
		.add('.panel-tab',   (e, t) => {
			showPanel(panel => {
				activatePanelTab(t);
			});
		})
		.add('.switch-to', (e, t) => {
			historyStateWrapper.pushState(t.href);
		})
		.add('.lightbox',  (e, t) => {
			function saveAsset () {
				if (!storage.config.auto_save_image.value) return;
				const saveLink = $qs(`.save-image[href="${t.href}"]`);
				if (!saveLink) return;
				return commands.saveAsset(saveLink);
			}

			if (!storage.config.lightbox_enabled.value) {
				saveAsset();
				return clickDispatcher.PASS_THROUGH;
			}

			if (/\.(?:jpe?g|gif|png|webp)$/i.test(t.href)) {
				displayLightbox(t).then(saveAsset);
			}
			else if (/\.(?:webm|mp4)$/i.test(t.href)) {
				saveAsset();
				displayInlineVideo(t);
			}
			else if (/\.(?:mp3|ogg)$/i.test(t.href)) {
				saveAsset();
				displayInlineAudio(t);
			}
		})
		.add('.catalog-order', (e, t) => {
			let newActive;

			$qsa('#catalog .catalog-options a').forEach(node => {
				if (node == t) {
					node.classList.add('active');
					newActive = node;
				}
				else {
					node.classList.remove('active');
				}
			});

			if (!newActive) {
				newActive = $qs('#catalog .catalog-options a');
				newActive.classList.add('active');
			}

			const order = newActive.href.match(/\w+$/)[0];
			const contentId = `catalog-threads-wrap-${order}`;
			$qsa('#catalog .catalog-threads-wrap > div').forEach(node => {
				if (node.id == contentId) {
					node.classList.remove('hide');
				}
				else {
					node.classList.add('hide');
				}
			});

			storage.runtime.catalog.sortOrder = order;
			storage.saveRuntime();
			commands.reload();
		})
		.add('.sodane', (e, t) => {
			commands.sodane(e, t);
		})
		.add('.sodane-null', (e, t) => {
			commands.sodane(e, t);
		})

		// debug features
		.add('#reload-full',       () => {
			return commands[pageModes[0].mode == 'reply' ? 'reloadReplies' : 'reload']();
		})
		.add('#reload-delta',      () => {
			return commands[pageModes[0].mode == 'reply' ? 'reloadRepliesViaAPI' : 'reload']();
		})
		.add('#dump-stats',        commands.dumpStats)
		.add('#dump-reload-data',  commands.dumpReloadData)
		.add('#empty-replies',     commands.emptyReplies)
		.add('#notice-test',       commands.noticeTest)
		.add('#toggle-timing-log', commands.toggleLogging)
		.add('#traverse',          commands.traverseTest)

		// generic handler for anchors without class
		.add('*noclass*', (e, t) => {
			const re1 = /(.*)#[^#]*$/.exec(t.href);
			const re2 = /(.*)(#[^#]*)?$/.exec(location.href);
			if (t.target != '_blank') return;
			if (re1 && re2 && re1[1] == re2[1]) return;

			e.preventDefault();
			e.stopPropagation();
			backend.send('open', {
				url: t.href,
				selfUrl: location.href
			});
		})

	/*
	 * instantiate keyboard shortcut manager
	 * and register shortcut handlers
	 */

	keyManager.ensure;
	keyManager
		.addStroke('command', 'r', commands.reload)
		.addStroke('command', [' ', '<S-space>'], commands.scrollPage, true)
		.addStroke('command', 'z', commands.summaryBack)
		.addStroke('command', '.', commands.summaryNext)
		.addStroke('command', '?', commands.openHelpDialog)
		.addStroke('command', 'c', commands.toggleCatalogVisibility)
		.addStroke('command', 'p', commands.togglePanelVisibility)
		.addStroke('command', 's', commands.activateStatisticsTab)
		.addStroke('command', '/', commands.activateSearchTab)
		.addStroke('command', 'n', commands.activateNoticeTab)

		.addStroke('command', 'i', commands.activatePostForm)
		.addStroke('command', '\u001b', commands.deactivatePostForm)

		.addStroke('command.edit', '\u001b', commands.deactivatePostForm)			// <esc>
		.addStroke('command.edit', ['\u0013', '<A-S>'], commands.toggleSage)		// ^S, <Alt+S>
		.addStroke('command.edit', '<A-D>', commands.voice)
		.addStroke('command.edit', '<A-S-D>', commands.semiVoice)
		.addStroke('command.edit', '<S-enter>', commands.post)						// <Shift+Enter>

		// These shortcuts for text editing are basically emacs-like...
		.addStroke('command.edit', '\u0001', commands.cursorBeginningOfLine)		// ^A
		.addStroke('command.edit', '\u0005', commands.cursorEndOfLine)				// ^E
		.addStroke('command.edit', '<A-N>',  commands.cursorNextLine)				// <Alt+N>: ^N alternative
		.addStroke('command.edit', '<A-P>',  commands.cursorPreviousLine)			// <Alt+P>: ^P alternative
		.addStroke('command.edit', '\u0006', commands.cursorForwardChar)			// ^F
		.addStroke('command.edit', '\u0002', commands.cursorBackwardChar)			// ^B
		.addStroke('command.edit', '<A-F>',  commands.cursorForwardWord)			// <Alt+F>
		.addStroke('command.edit', '<A-B>',  commands.cursorBackwardWord)			// <Alt+B>
		.addStroke('command.edit', '\u0008', commands.cursorDeleteBackwardChar)		// ^H
		.addStroke('command.edit', '<A-H>',  commands.cursorDeleteBackwardWord)		// <Alt+H>: ^W alternative
		.addStroke('command.edit', '\u0015', commands.cursorDeleteBackwardBlock)	// ^U
		.addStroke('command.edit', '<C-/>',  commands.selectAll);					// ^/

	/*
	 * favicon maintainer
	 */

	favicon.update();

	/*
	 * window resize handler
	 */

	(() => {
		function updateViewportRectGeometry () {
			const vp = document.body.appendChild(document.createElement('div'));
			try {
				vp.id = 'viewport-rect';
				viewportRect = vp.getBoundingClientRect();
			}
			finally {
				vp.parentNode.removeChild(vp);
			}
		}

		function updateMaxSizeOfDialogs (style) {
			style.appendChild(document.createTextNode([
				`.dialog-wrap .dialog-content {`,
				`  max-width:${Math.floor(viewportRect.width * 0.8)}px;`,
				`  max-height:${Math.floor(viewportRect.height * 0.8)}px;`,
				`  min-width:${Math.floor(viewportRect.width * 0.25)}px;`,
				'}'
			].join('\n')));
		}

		function updateHeaderHeight (style) {
			const headerHeight = $('header').offsetHeight + HEADER_MARGIN_BOTTOM;
			$('content').style.marginTop =
			$('catalog').style.marginTop =
			$('content-loading-indicator').style.marginTop =
			$('ad-aside-wrap').style.top =
			$('panel-aside-wrap').style.top = headerHeight + 'px';
			style.appendChild(document.createTextNode([
				`#content > article > .image > div {`,
				`  top:${headerHeight}px`,
				'}'
			].join('\n')));
		}

		function readjustReplyWidth () {
			$qsa('.reply-wrap .reply-image.width-adjusted').forEach(node => {
				node.classList.remove('width-adjusted');
				node.style.minWidth = '';
			});
			adjustReplyWidth();
		}

		function handler () {
			const style = $('dynstyle-comment-maxwidth');
			if (!style) return;
			empty(style);

			updateViewportRectGeometry(style);
			updateMaxSizeOfDialogs(style);
			updateHeaderHeight(style);
			//readjustReplyWidth();
		}

		setupWindowResizeEvent(100, handler);
	})();

	/*
	 * history handler
	 */

	historyStateWrapper.setHandler(() => {
		/*
		console.log([
			`  previous page mode: ${pageModes[0].mode}`,
			`current page address: ${location.href}`
		].join('\n'));
		*/

		const isCatalog = location.hash == '#mode=cat';

		if (pageModes[0].mode == 'catalog' && !isCatalog
		||  pageModes[0].mode != 'catalog' && isCatalog) {
			commands.toggleCatalogVisibility();
		}

		if (pageModes[0].mode == 'summary') {
			const re = /(\d+)\.htm$/.exec(location.pathname);
			siteInfo.summaryIndex = re ? re[1] : 0;
			commands.reload();
		}
		else if (pageModes[0].mode == 'catalog' && pageModes[1].mode == 'summary') {
			const re = /(\d+)\.htm$/.exec(location.pathname);
			const summaryIndex = siteInfo.summaryIndex = re ? re[1] : 0;

			// title sync
			const titleElement = $qs('#header h1 a span:last-child');
			let title = titleElement
				.textContent
				.replace(/\s*\[ページ\s*\d+\]/, '');
			if (summaryIndex) {
				title += ` [ページ ${summaryIndex}]`;
			}
			$t(titleElement, title);

			// page navigator sync
			const navElement = $qs('#postform-wrap .nav-links');
			const pageCount = Math.min(11, navElement.childElementCount);
			empty(navElement);
			for (let i = 0; i < pageCount; i++) {
				if (i == summaryIndex) {
					const span = navElement.appendChild(document.createElement('span'));
					span.className = 'current';
					$t(span, i);
				}
				else {
					const a = navElement.appendChild(document.createElement('a'));
					a.className = 'switch-to';
					a.href = `${location.protocol}//${location.host}/${siteInfo.board}/${i == 0 ? 'futaba' : i}.htm`;
					$t(a, i);
				}
			}
		}
	});

	/*
	 * quote popup
	 */

	quotePopup.ensure;

	/*
	 * selection menu handler
	 */

	selectionMenu.ensure;

	/*
	 * mouse cursor tracker
	 */

	window.addEventListener('mousemove', e => {
		cursorPos.x = e.clientX;
		cursorPos.y = e.clientY;
		cursorPos.pagex = e.pageX;
		cursorPos.pagey = e.pageY;
		cursorPos.moved = true;
	}, false);

	/*
	 * restore cookie value
	 */

	$t('name', getCookie('namec'));
	$t('pwd', getCookie('pwdc'));

	/*
	 * init some hidden parameters
	 */

	$t(document.getElementsByName('js')[0],
		'on');
	$t(document.getElementsByName('scsz')[0],
		[
			window.screen.width,
			window.screen.height,
			window.screen.colorDepth
		].join('x'));

	/*
	 * post form
	 */

	// submit listener
	$('postform') && $('postform').addEventListener('submit', e => {
		e.preventDefault();
		commands.post();
	});

	// post mode switcher
	((elms, handler) => {
		for (let i = 0; i < elms.length; i++) {
			elms[i].addEventListener('click', handler, false);
		}
	})(document.getElementsByName('post-switch'), e => {
		const resto = document.getElementsByName('resto')[0];

		switch (e.target.value) {
		case 'reply':
			resto.disabled = false;
			break;

		case 'thread':
			resto.disabled = true;
			break;
		}
	});

	// allow tegaki link, if baseform element exists
	(drawButtonWrap => {
		if (!drawButtonWrap) return;

		if (document.getElementsByName('baseform').length == 0) {
			// baseform not exists. disable tegaki link
			drawButtonWrap.classList.add('hide');

			// additionally in reply mode, disable upload feature
			if (pageModes[0].mode == 'reply') {
				const upfile = $('upfile');
				const textonly = $('textonly');
				upfile.disabled = textonly.disabled = true;
			}
		}
		else {
			// allow tegaki link
			drawButtonWrap.classList.remove('hide');
		}

	})($qs('.draw-button-wrap'));

	// handle behavior of text fields
	setupPostFormItemEvent([
		{id:'com',              bytes:1000, lines:15},
		{id:'name',  head:'名', bytes:100},
		{id:'email', head:'メ', bytes:100},
		{id:'sub',   head:'題', bytes:100}
	]);

	// handle post form visibility
	(() => {
		let frameOutTimer;
		$('postform-wrap').addEventListener('mouseenter', e => {
			if (frameOutTimer) {
				clearTimeout(frameOutTimer);
				frameOutTimer = null;
			}
			commands.activatePostForm('postform-wrap#mouseenter');
		});
		$('postform-wrap').addEventListener('mouseleave', e => {
			if (frameOutTimer) return;

			frameOutTimer = setTimeout(() => {
				frameOutTimer = null;
				let p = document.elementFromPoint(cursorPos.x, cursorPos.y);
				while (p && p.id != 'postform-wrap') {
					p = p.parentNode;
				}
				if (p) return;
				const thumb = $('post-image-thumbnail-wrap');
				if (thumb && thumb.getAttribute('data-available') == '2') {
					thumb.setAttribute('data-available', '1');
					return;
				}
				commands.deactivatePostForm();
			}, POSTFORM_DEACTIVATE_DELAY);
		});
	})();

	/*
	 * parallax banner handling
	 */

	setupParallax('#ad-aside-wrap');

	/*
	 * inline video viewer
	 */

	setupVideoViewer();

	/*
	 * mouse wheel handler
	 */

	setupWheelReload();

	/*
	 * sounds
	 */

	sounds = {
		identified: createSound('identified'),
		detectNewMark: createSound('new-mark'),
		imageSaved: createSound('image-saved'),
		trackerWorked: createSound('tracker-worked')
	};

	/*
	 * panel
	 */

	// submit button on search panel
	$('search-form').addEventListener('submit', e => {
		commands.search();
	});

	// pseudo mousehoverin/mousehoverout events for search item
	// on reply search panel and statistics panel
	setupSearchResultPopup();

	/*
	 * register custom event handler
	 */

	setupCustomEventHandler();

	/*
	 * uucount/uuacount, based on base4.js
	 */

	{
		// uuacount: unique user in short time period?
		const p = [getImageFrom(`/bin/uuacount.php?${Math.floor(Math.random() * 1000)}`)];

		// We found that this code was removed from base4ajax.js on Jan.22
		/*
		const uuc = getCookie('uuc');
		if (uuc != '1') {
			// uucount: unique user per hour?
			p.push(getImageFrom(`//dec.2chan.net/bin/uucount.php?${Math.random()}`));
			document.cookie = 'uuc=1; max-age=3600; path=/;';
		}
		*/

		Promise.all(p);
	}

	/*
	 * switch according to mode of pseudo-query
	 */

	let queries = (() => {
		const result = {};
		location.hash
		.replace(/^#/, '')
		.split('&').forEach(s => {
			s = s.split('=');
			s[0] = decodeURIComponent(s[0]);
			s[1] = s.length >= 2 ? decodeURIComponent(s[1]) : null;
			result[s[0]] = s[1];
		});
		return result;
	})();

	switch (queries.mode) {
	case 'cat':
		setTimeout(() => {
			commands.toggleCatalogVisibility();
		}, 0);
		break;
	}

	/*
	 * finish
	 */

	$('content').classList.add('transition-enabled');
}

/*
 * <<<1 applyDataBindings: apply a data in xml to a element, with its data binding definition
 */

function applyDataBindings (xml) {
	for (const node of $qsa('*[data-binding]')) {
		const binding = node.getAttribute('data-binding');
		let re;

		// xpath:<path/to/xml/element>
		// xpath[<page-mode>]:<path/to/xml/element>
		if ((re = /^xpath(?:\[([^\]]+)\])?:(.+)/.exec(binding))) {
			if (typeof re[1] == 'string' && re[1] != pageModes[0].mode) continue;
			try {
				const result = xml.evaluate(re[2], xml, null,
					window.XPathResult.FIRST_ORDERED_NODE_TYPE, null);
				if (!result || !result.singleNodeValue) continue;
				$t(node,
					result.singleNodeValue.value
					|| result.singleNodeValue.textContent);
			}
			catch (e) {
				console.error(
					`${APP_NAME}: applyDataBindings: failed to apply the data "${re[2]}"` +
					`\n${e.stack}`);
			}
		}

		// xpath-class:<path/to/xml/element>
		// xpath-class[<page-mode>]:<path/to/xml/element>
		else if ((re = /^xpath-class(?:\[([^\]]+)\])?:(.+)/.exec(binding))) {
			if (typeof re[1] == 'string' && re[1] != pageModes[0].mode) continue;
			try {
				const result = xml.evaluate(re[2], xml, null,
					window.XPathResult.STRING_TYPE, null);
				if (!result || !result.stringValue) continue;
				node.className = result.stringValue;
			}
			catch (e) {
				console.error(
					`${APP_NAME}: applyDataBindings: failed to apply the data "${re[2]}" to class` +
					`\n${e.stack}`);
			}
		}

		// template:<template-name>
		// template[<page-mode>]:<template-name>
		else if ((re = /^template(?:\[([^\]]+)\])?:(.+)/.exec(binding))) {
			if (typeof re[1] == 'string' && re[1] != pageModes[0].mode) continue;
			try {
				xsltProcessor.setParameter(null, 'render_mode', re[2]);
				const f = fixFragment(xsltProcessor.transformToFragment(xml, document));
				if (f.textContent.replace(/^\s+|\s+$/g, '') == '' && !$qs('[data-doe]', f)) continue;
				empty(node);
				extractDisableOutputEscapingTags(node, f);
			}
			catch (e) {
				console.error(
					`${APP_NAME}: applyDataBindings: failed to apply the template "${re[2]}"` +
					`\n${e.stack}`);
			}
		}
	}
}

/*
 * <<<1 classes / class constructors
 */

function createExtensionBackend () {
	let connection;

	function Connection () {
		this.tabId = null;
		this.browserInfo = null;
		this.requestNumber = 0;
	}
	Connection.prototype = {
		postMessage: function (data, callback) {
			let type;
			let requestNumber = this.getNewRequestNumber();

			data || (data = {});

			if ('type' in data) {
				type = data.type;
				delete data.type;
			}

			this.doPostMessage({
				type: type || 'unknown-command',
				tabId: this.tabId,
				requestNumber: requestNumber,
				data: data
			}, callback);

			return requestNumber;
		},
		doPostMessage: function (data, callback) {},
		connect: function (type, callback) {
			this.doConnect();
			this.doPostMessage({
				type: type || 'init',
				tabId: this.tabId,
				requestNumber: this.getNewRequestNumber(),
				data: {url: location.href}
			}, callback);
		},
		connectp: function (type) {
			return new Promise(resolve => {
				this.connect(type, resolve);
			});
		},
		doConnect: function () {},
		disconnect: function () {
			this.doDisconnect();
		},
		doDisconnect: function () {},
		setMessageListener: function (handler) {},
		addMessageListener: function (handler) {},
		removeMessageListener: function (handler) {},
		runCallback: function (...args) {
			let callback = args.shift();
			if (typeof callback != 'function') {
				return;
			}
			return callback.apply(null, args);
		},
		getUniqueId: function () {
			return APP_NAME
				+ '_' + Date.now()
				+ '_' + Math.floor(Math.random() * 0x10000);
		},
		getNewRequestNumber: function () {
			this.requestNumber = (this.requestNumber + 1) & 0xffff;
			return this.requestNumber;
		},
		getMessage: function (messageId) {
			return messageId;
		},
		ensureRun: function (...args) {
			let callback = args.shift();
			let doc;
			try {
				doc = document;
				doc.body;
			}
			catch (e) {
				return;
			}
			if (doc.readyState == 'interactive'
			||  doc.readyState == 'complete') {
				callback.apply(null, args);
				callback = args = null;
			}
			else {
				doc.addEventListener('DOMContentLoaded', e => {
					callback.apply(null, args);
					e = callback = args = null;
				}, {once: true});
			}
		}
	};

	function ChromeConnection () {
		Connection.apply(this, arguments);

		let onMessageHandlers = [];

		function handleMessage (req, sender, response) {
			let result = false;
			for (const handler of onMessageHandlers) {
				result = !!handler(req, sender, response) || result;
			}
			return result;
		}

		this.constructor = Connection;
		this.runType = 'chrome-extension';
		this.doPostMessage = function (data, callback) {
			try {
				chrome.runtime.sendMessage(data, response => {
					if (chrome.runtime.lastError) {
						console.error(`${APP_NAME}: chrome.runtime.sendMessage failed (${chrome.runtime.lastError.message})`);
						callback();
					}
					else {
						callback(response);
					}
				});
			}
			catch (e) {
				console.error(`${APP_NAME}: chrome.runtime.sendMessage failed (${e.stack})`);
				throw e;
			}
		};
		this.doConnect = function () {
			chrome.runtime.onMessage.addListener(handleMessage);
		};
		this.doDisconnect = function () {
			onMessageHandlers.length = 0;
			chrome.runtime.onMessage.removeListener(handleMessage);
		};
		this.setMessageListener = function (handler) {
			onMessageHandlers = [handler];
		};
		this.addMessageListener = function (handler) {
			const index = onMessageHandlers.indexOf(handler);
			if (index < 0) {
				onMessageHandlers.push(handler);
			}
		};
		this.removeMessageListener = function (handler) {
			const index = onMessageHandlers.indexOf(handler);
			if (index >= 0) {
				onMessageHandlers.splice(index, 1);
			}
		};
	}
	ChromeConnection.prototype = Connection.prototype;

	function createConnection () {
		if (typeof chrome !== 'undefined') return new ChromeConnection;
		return new Connection;
	};

	async function connect () {
		if (connection) return;

		connection = createConnection();

		for (let retryRest = 5, wait = 1000; retryRest > 0; retryRest--, wait += 1000) {
			const response = await connection.connectp('init');
			if (response) {
				connection.tabId = response.tabId;
				connection.browserInfo = response.browserInfo;
				return response;
			}
			await new Promise(resolve => setTimeout(resolve, wait));
		}

		return null;
	};

	function send (...args) {
		if (!connection) return;

		let data, callback;

		if (args.length > 1 && typeof args[args.length - 1] == 'function') {
			callback = args.pop();
		}
		if (args.length > 1) {
			data = args.pop();
		}
		else {
			data = {};
		}

		data.type = args[0];
		if (callback) {
			try {
				connection.postMessage(data, callback);
			}
			catch (err) {
				console.error(`${APP_NAME}: send: ${err.stack}`);
				throw new Error(chrome.i18n.getMessage('cannot_connect_to_backend'));
			}
		}
		else {
			return new Promise(resolve => {
				connection.postMessage(data, resolve);
			})
			.catch(err => {
				console.error(`${APP_NAME}: send: ${err.stack}`);
				throw new Error(chrome.i18n.getMessage('cannot_connect_to_backend'));
			});
		}
	}

	function setMessageListener (listener) {
		if (!connection) return;
		connection.setMessageListener(listener);
	}

	return {
		connect, send, setMessageListener,
		get extensionId () {
			// extension id can be retrieved by chrome.runtime.id in chrome,
			// but Firefox's WebExtensions distinguishes extension id from
			// runtime UUID.
			const url = chrome.runtime.getURL('README.md');
			let re = /^[^:]+:\/\/([^\/]+)/.exec(url);
			return re[1];
		},
		get browserInfo () {
			return connection && connection.browserInfo || {};
		}
	};
}

function createResourceManager () {
	const ENABLE_NIGHT_MODE = false;

	const transformers = [
		function updateI18nMarks (s) {
			s = s.replace(/__MSG_@@extension_id__/g, backend.extensionId);
			return s;
		},
		function chromeToMoz (s) {
			if (IS_GECKO) {
				s = s.replace(/<style[^>]*>[\s\S]*?<\/style[^>]*>/gi, s1 => {
					return s1.replace(/chrome-extension:/g, 'moz-extension:');
				});
			}
			return s;
		},
		function toNightMode (s) {
			if (ENABLE_NIGHT_MODE) {
				const map = {
					ffe: '4d3d33',
					800: 'e5cdcc',
					ea8: 'a05734',
					f0e0d6: '614a3d',
					faf4e6: '5a4539'
				};
				s = s.replace(/<style[^>]*>[\s\S]*?<\/style[^>]*>/gi, s1 => {
					return s1.replace(/#((?:ffe|800|ea8)[0-9a-f]?|(?:f0e0d6|faf4e6)(?:[0-9a-f]{2})?)\b/gi, (s2, s3) => {
						// 4 digits
						if (s3.length == 4) {
							const alpha = s3.substr(-1);
							s3 = s3.substring(0, s3.length - 1);
							const result = map[s3.toLowerCase()];
							if (result.length == 3) {
								return `#${result}${alpha}`;
							}
							else {
								return `#${result}${alpha}${alpha}`;
							}
						}

						// 8 digits
						else if (s3.length == 8) {
							const alpha = s3.substr(-2);
							s3 = s3.substring(0, s3.length - 2);
							const result = map[s3.toLowerCase()];
							return `#${result}${alpha}`;
						}

						// others
						return `#${map[s3.toLowerCase()]}`;
					});
				});
			}
			return s;
		}
	];

	function setSlot (path, expires, data) {
		const slot = {
			expires: Date.now() + (expires === undefined ? 1000 * 60 * 60 : expires),
			data: data
		};
		window.localStorage.setItem(getResKey(path), JSON.stringify(slot));
	}

	function loadWithXHR (path, expires, responseType, callback) {
		let xhr = transport.create();

		xhr.open('GET', chrome.runtime.getURL(path));
		xhr.onload = () => {
			if (responseType == 'dataURL') {
				let fr = new FileReader;
				fr.onload = () => {
					setSlot(path, expires, fr.result);
					callback(fr.result);
				};
				fr.onerror = () => { callback(); };
				fr.onloadend = () => { fr = null; };
				fr.readAsDataURL(xhr.response);
			}
			else {
				let result = xhr.response;
				for (let t of transformers) {
					result = t(result);
				}
				setSlot(path, expires, result);
				callback(result);
			}
		};
		xhr.onerror = () => { callback(null); };
		xhr.onloadend = () => { xhr = null; };

		if (responseType == 'dataURL') {
			xhr.responseType = 'blob';
		}
		else {
			xhr.responseType = responseType;
		}

		xhr.setRequestHeader('X-Requested-With', `${APP_NAME}/${version}`);
		xhr.send();
	}

	function getResKey (key) {
		return `resource:${key}`;
	}

	function get (key, opts) { /*returns promise*/
		opts || (opts = {});
		const resKey = getResKey(key);
		const responseType = opts.responseType || 'text';
		const expires = opts.expires;
		let slot = window.localStorage.getItem(resKey);
		if (slot !== null) {
			slot = JSON.parse(slot);
			if (Date.now() < slot.expires) {
				return Promise.resolve(slot.data);
			}
			window.localStorage.removeItem(resKey);
		}

		return new Promise(resolve => {
			loadWithXHR(key, expires, responseType, resolve);
		});
	}

	function remove (key) {
		window.localStorage.removeItem(getResKey(key));
	}

	function clearCache () {
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i);
			if (/^resource:/.test(key)) {
				window.localStorage.removeItem(key);
				i--;
			}
		}
	}

	return {get, remove, clearCache};
}

function createLinkifier () {
	// link target class
	function LinkTarget (pattern, handler, options = {}) {
		this.pattern = pattern;
		this.handler = handler;
		this.className = options.className || 'link-external';
		this.preferredScheme = options.preferredScheme || undefined;
		this.overrideScheme = options.overrideScheme || undefined;
		this.title = options.title || undefined;
	}

	LinkTarget.prototype.setupAnchor = function (re, anchor) {
		const params = re
			.slice(this.offset, this.offset + this.backrefLength)
			.map(a => a == undefined ? '' : a);
		const anchorProxy = anchor instanceof HTMLAnchorElement ?
			{
				setAttribute: (key, value) => {
					if (key != 'className' && key != 'class' && key != 'href') {
						anchor.setAttribute(`data-${key}`, value);
					}
					else {
						anchor.setAttribute(key, value);
					}
				}
			} : anchor;

		if (this.className != undefined) {
			anchorProxy.setAttribute('class', this.className);
		}

		if (this.title != undefined) {
			anchorProxy.setAttribute('title', this.title);
		}

		let href = this.handler(params, anchorProxy);
		if (this.overrideScheme != undefined) {
			href = this.overrideScheme + '//' + href.replace(/^(?:[^:]+:)?\/\//, '');
		}
		else {
			href = this.completeScheme(href);
		}
		anchorProxy.setAttribute('href', href);
	};

	LinkTarget.prototype.completeScheme = function (url) {
		const defaultScheme = this.preferredScheme || 'http:';

		// * (http) is default scheme
		//
		// www.example.net   -> (http)://www.example.net
		// //www.example.net -> (http)://www.example.net
		const re = /^([^:]+):/.exec(url);
		if (!re) {
			return defaultScheme + '//' + url.replace(/^\/+/, '');
		}

		// ://www.example.net  -> (http)://www.example.net
		// p://www.example.net -> http://www.example.net
		// s://www.example.net -> https://www.example.net
		let scheme = defaultScheme;
		if (/^h?t?t?p?s$/.test(re[1])) {
			scheme = 'https:';
		}
		else if (/^h?t?t?p$/.test(re[1])) {
			scheme = 'http:';
		}

		return scheme + url.replace(/^[^:]+:/, '');
	}


	// utility functions
	/*
	function siokaraHandler (re, anchor, baseUrl) {
		const [whole, fileId, extension] = re;

		if (extension) {
			anchor.setAttribute('basename', fileId + extension);
			if (/\.(?:jpe?g|gif|png|webp|webm|mp4|mp3|ogg)$/.test(extension)) {
				anchor.setAttribute(
					'class',
					`${this.className} incomplete-thumbnail lightbox`);
				anchor.setAttribute(
					'thumbnail',
					this.completeScheme(`${baseUrl}misc/${fileId}.thumb.jpg`));
			}
			return `${baseUrl}src/${fileId}${extension}`;
		}
		else {
			anchor.setAttribute('basename', fileId);
			anchor.setAttribute('class', `${this.className} incomplete`);
			return `${baseUrl}index.html`;
		}
	}
	*/

	function upHandler (re, anchor, baseUrl) {
		const [whole, scheme, fileId, extension] = re;

		if (extension) {
			anchor.setAttribute('basename', fileId + extension);

			// inline lightbox
			if (/\.(?:jpe?g|gif|png|webp|webm|mp4|mp3|ogg)$/.test(extension)) {
				anchor.setAttribute(
					'class',
					`${this.className} lightbox`);
			}

			// if thumbnail supported, add attribute
			if (/\.(?:jpe?g|gif|png|webp|webm|mp4)$/.test(extension)) {
				const boardName = /\/(up2?)\/$/.exec(baseUrl)[1];
				anchor.setAttribute(
					'thumbnail',
					`https://appsweets.net/thumbnail/${boardName}/${fileId}s.png`);
			}

			return `${scheme}${baseUrl}src/${fileId}${extension}`;
		}
		else {
			anchor.setAttribute('basename', fileId);
			anchor.setAttribute('class', `${this.className} incomplete`);
			return `${scheme}${baseUrl}up.htm`;
		}
	}

	function decodePercentEncode (text) {
		try {
			return text.replace(/(?:%[0-9a-f][0-9a-f])+/gi, $0 => decodeURIComponent($0));
		}
		catch (e) {
			return text;
		}
	}

	function reduceURL (url) {
		const LIMIT = 100;
		const seps = ['/', '&'];

		if (url.length <= LIMIT) {
			return url;
		}

		let re = /^([^:]+:\/\/[^\/]+\/)([^?]*)?(\?.*)?/.exec(url);
		let result = re[1];
		const components = [(re[2] || '').split(seps[0]), (re[3] || '').split(seps[1])];

		components.forEach((cs, i) => {
			if (i == 1 && components[0].length) return;

			while (cs.length && result.length < LIMIT) {
				result += cs[0];
				if (cs.length > 1) {
					result += seps[i];
				}
				cs.shift();
			}

			if (result.length >= LIMIT) {
				const lastIndex = result.lastIndexOf(seps[i]);
				if (lastIndex >= 0) {
					cs.push(result.substring(lastIndex + 1));
					result = result.substring(0, lastIndex + 1);
				}
			}
		});

		if (components[0].length || components[1].length) {
			result += '...(省略)';
		}

		return result;
	}

	function findLinkTarget (re) {
		let linkTarget;
		linkTargets.some((a, i) => {
			if (re[a.offset] != undefined && re[a.offset] != '') {
				linkTarget = a;
				return true;
			}
		});
		return linkTarget;
	}

	// ported from https://github.com/twitter/twemoji/blob/gh-pages/2/twemoji.js
	// from here:
	const UFE0Fg = /\uFE0F/g
	const U200D = String.fromCharCode(0x200D);

	function grabTheRightIcon (rawText) {
		// if variant is present as \uFE0F
		return toCodePoint(rawText.indexOf(U200D) < 0 ?
			rawText.replace(UFE0Fg, '') :
			rawText
		);
	}

	function toCodePoint (unicodeSurrogates, sep) {
		let
		r = [],
			c = 0,
			p = 0,
			i = 0;
		while (i < unicodeSurrogates.length) {
			c = unicodeSurrogates.charCodeAt(i++);
			if (p) {
				r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
				p = 0;
			} else if (0xD800 <= c && c <= 0xDBFF) {
				p = c;
			} else {
				r.push(c.toString(16));
			}
		}
		return r.join(sep || '-');
	}
	// ported from https://github.com/twitter/twemoji/blob/gh-pages/2/twemoji.js
	// to here.

	// constants
	const linkTargets = [
		/*
		new LinkTarget(
			'(?:h?t?t?p?s?://)?(?:www\\.nijibox6\\.com/futabafiles/001/src/)?(sa\\d{4,})(\\.\\w+)?',
			function (re, anchor) {
				return siokaraHandler.call(
					this, re, anchor, '//www.nijibox6.com/futabafiles/001/');
			},
			{
				className: 'link-siokara',
				title: '塩辛瓶 1ml',
				overrideScheme: 'http:'
			}
		),
		new LinkTarget(
			'(?:h?t?t?p?s?://)?(?:www\\.nijibox2\\.com/futabafiles/003/src/)?(sp\\d{4,})(\\.\\w+)?',
			function (re, anchor) {
				return siokaraHandler.call(
					this, re, anchor, '//www.nijibox2.com/futabafiles/003/');
			},
			{
				className: 'link-siokara',
				title: '塩辛瓶 3ml',
				overrideScheme: 'http:'
			}
		),
		new LinkTarget(
			'(?:h?t?t?p?s?://)?(?:www\\.nijibox5\\.com/futabafiles/kobin/src/)?(ss\\d{4,})(\\.\\w+)?',
			function (re, anchor) {
				return siokaraHandler.call(
					this, re, anchor, '//www.nijibox5.com/futabafiles/kobin/');
			},
			{
				className: 'link-siokara',
				title: '塩辛瓶 小瓶',
				overrideScheme: 'http:'
			}
		),
		new LinkTarget(
			'(?:h?t?t?p?s?://)?(?:www\\.nijibox5\\.com/futabafiles/tubu/src/)?(su\\d{4,})(\\.\\w+)?',
			function (re, anchor) {
				return siokaraHandler.call(
					this, re, anchor, '//www.nijibox5.com/futabafiles/tubu/');
			},
			{
				className: 'link-siokara',
				title: '塩辛瓶 塩粒',
				overrideScheme: 'http:'
			}
		),
		new LinkTarget(
			'(?:h?t?t?p?s?://)?(?:www\\.nijibox6\\.com/futabafiles/mid/src/)?(sq\\d{4,})(\\.\\w+)?',
			function (re, anchor) {
				return siokaraHandler.call(
					this, re, anchor, '//www.nijibox6.com/futabafiles/mid/');
			},
			{
				className: 'link-siokara',
				title: '塩辛瓶 中瓶',
				overrideScheme: 'http:'
			}
		),
		new LinkTarget(
			'(?:h?t?t?p?s?://)?(?:www\\.nijibox2\\.com/futalog/src/)?((?:dec|jun|nov|may|img|dat|cgi|nne|id|jik|nar|oth)\\d{4,})\\.mht',
			function (re, anchor) {
				return 'http://www.nijibox2.com/futalog/src/' +
					   re[1].replace('oth', 'other') + '.mht';
			},
			{
				className: 'link-futalog',
				title: 'ふたログ',
				overrideScheme: 'http:'
			}
		),
		*/
		new LinkTarget(
			'(h?t?t?p?s?://)?(?:dec\\.2chan\\.net/up/src/)?(f\\d{4,})(\\.\\w+)?',
			function (re, anchor) {
				return upHandler.call(
					this, re, anchor, 'dec.2chan.net/up/');
			},
			{
				className: 'link-up',
				title: 'あぷ',
				preferredScheme: 'https:'
			}
		),
		new LinkTarget(
			'(h?t?t?p?s?://)?(?:dec\\.2chan\\.net/up2/src/)?(fu\\d{4,})(\\.\\w+)?',
			function (re, anchor) {
				return upHandler.call(
					this, re, anchor, 'dec.2chan.net/up2/');
			},
			{
				className: 'link-up',
				title: 'あぷ小',
				preferredScheme: 'https:'
			}
		),
		new LinkTarget(
			'(h?t?t?p?s?://)?[^.]+\\.2chan\\.net/[^/]+/src/\\d+\\.(?:jpe?g|gif|png|webp|webm|mp4)',
			function (re, anchor) {
				anchor.setAttribute(
					'thumbnail',
					this.completeScheme(re[0]
						.replace('/src/', '/thumb/')
						.replace(/\.[^.]+$/, 's.jpg')));
				return re[0];
			},
			{
				className: 'link-futaba lightbox',
				preferredScheme: 'https:'
			}
		),
		new LinkTarget(
			'(?:h?t?t?p?s?://)?(' + [
				'(?:(?:www|m)\\.)?youtube\\.com/[^/]+\\?(?:.*?v=([\\w\\-]+))',
				'(?:(?:www|m)\\.)?youtube\\.com/(?:v|embed)/([\\w\\-]+)',
				'youtu\\.be/([\\w\\-]+)'
			].join('|') + ')(?:[?&]\\S+(?:=\\S*)?)*',
			function (re, anchor) {
				anchor.setAttribute('youtube-key', re[2] || re[3] || re[4]);
				return re[0];
			},
			{
				className: 'link-youtube',
				title: 'YouTube',
				overrideScheme: 'https:'
			}
		),
		new LinkTarget(
			'(?:h?t?t?p?s?://)?(' + [
				'(?:[^.]+\\.)?nicovideo\\.jp/watch/(sm\\w+)',
				'nico\\.ms/(sm\\w+)'
			].join('|') + ')(?:[?&]\\S+(?:=\\S*)?)*',
			function (re, anchor) {
				anchor.setAttribute('nico2-key', re[2] || re[3]);
				return re[0];
			},
			{
				className: 'link-nico2',
				title: 'ニコニコ動画',
				overrideScheme: 'https:'
			}
		),
		new LinkTarget(
			'(?:h?t?t?p?s?://)?twitter\\.com/[^/]+/status/(\\d+)(?:[?&]\\S+(?:=\\S*)?)*',
			function (re, anchor) {
				anchor.setAttribute('tweet-id', re[1]);
				return re[0];
			},
			{
				className: 'link-twitter',
				title: 'Twitter',
				overrideScheme: 'https:'
			}
		),
		new LinkTarget(
			'(?:[^:\\s]+://|www\\.)(?:[^.]+\\.)+[^.]+(?::\\d+)?/\\S*',
			function (re, anchor) {
				return re[0];
			},
			{
				className: 'link-external'
			}
		)
	];

	const linkTargetRegex = new RegExp(
		'\\b(?:(' + linkTargets
		.map((a, i) => {
			const re = (a.pattern.replace(/\(\?/g, '')).match(/\(/g);
			linkTargets[i].backrefLength = (re ? re.length : 0) + 1;
			linkTargets[i].offset = i > 0 ?
				linkTargets[i - 1].offset + linkTargets[i - 1].backrefLength :
				1;
			return a.pattern;
		})
		.join(')|(') + '))'
	);

	// public functions
	function linkify (node, opts = {linkify: true, emojify: true}) {
		const emojiRegex = typeof Akahuku == 'object' ? Akahuku.twemoji.regex : /\x00/;
		const r = node.ownerDocument.createRange();
		let re;
		while (node.lastChild && node.lastChild.nodeType == 3) {
			if (opts.linkify && (re = linkTargetRegex.exec(node.lastChild.nodeValue))) {
				const linkTarget = findLinkTarget(re);
				if (!linkTarget) break;

				const anchor = node.ownerDocument.createElement('a');
				r.setStart(node.lastChild, re.index);
				r.setEnd(node.lastChild, re.index + re[0].length);
				r.surroundContents(anchor);

				anchor.textContent = decodePercentEncode(anchor.textContent);
				anchor.textContent = reduceURL(anchor.textContent);
				linkTarget.setupAnchor(re, anchor);
			}

			else if (opts.emojify && (re = emojiRegex.exec(node.lastChild.nodeValue))) {
				const emoji = node.ownerDocument.createElement('emoji');

				r.setStart(node.lastChild, re.index);
				r.setEnd(node.lastChild, re.index + re[0].length);
				r.surroundContents(emoji);

				emoji.setAttribute('codepoints', grabTheRightIcon(re[0]));
			}

			else {
				node.lastChild.nodeValue = node.lastChild.nodeValue.replace(
					/[a-zA-Z0-9\u3040-\u30ff\uff10-\uff19\uff21-\uff3a\uff41-\uff5a]{20}/g,
					'$&\u200b');
				break;
			}
		}
	}

	// export
	return {linkify}
}

function createXMLGenerator () {
	/*
	 * utility functions
	 */

	function stripTags (s) {
		const result = [];
		const pattern = /<[^>]+>|[^<]+/g;
		let re;
		while ((re = pattern.exec(s))) {
			if (re[0].charAt(0) != '<') {
				result.push(re[0]);
			}
		}
		return result.join('');
	}

	function stripTagsForNotice (s) {
		const result = [];
		const pattern = /<[^>]+>|[^<]+/g;
		let re;
		while ((re = pattern.exec(s))) {
			if (re[0].charAt(0) == '<') {
				let re2;
				if ((re2 = /<a\b.*href="([^"]*)"/.exec(re[0]))) {
					result.push(`<a href="${re2[1]}">`);
				}
				else if ((re2 = /<\/a\b/.exec(re[0]))) {
					result.push(`</a>`);
				}
			}
			else {
				result.push(re[0]);
			}
		}
		return result.join('');
	}

	function textFactory (xml, nodeOnly) {
		if (nodeOnly) {
			return s => xml.createTextNode('' + s);
		}
		else {
			const refmap = {'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"'};
			return s => {
				s = ('' + s).replace(/&(?:amp|lt|gt|quot);/g, $0 => refmap[$0]);
				return xml.createTextNode(s);
			};
		}
	}

	function element (node, s) {
		return node.appendChild(node.ownerDocument.createElement(s));
	}

	function setDefaultSubjectAndName (xml, text, metaNode, subHash, nameHash) {
		element(metaNode, 'sub_default')
			.appendChild(text((Object.keys(subHash).sort((a, b) => subHash[b] - subHash[a])[0] || '').replace(/^\s+|\s+$/g, '')));
		element(metaNode, 'name_default')
			.appendChild(text((Object.keys(nameHash).sort((a, b) => nameHash[b] - nameHash[a])[0] || '').replace(/^\s+|\s+$/g, '')));
	}

	function pushComment (node, text, s) {
		const stack = [node];
		const regex = /<[^>]+>|[^<]+/g;
		let re;
		while ((re = regex.exec(s))) {
			re = re[0];
			if (re.charAt(0) == '<') {
				if (re.charAt(1) == '/') {
					stack.shift();
					stack.length == 0 && stack.push(node);
				}
				else {
					if (re == '<br>') {
						stack[0].appendChild(text('\n'));
						stack[0].appendChild(element(stack[0], 'br'));
					}
					else if (re == '<font color="#789922">') {
						stack.unshift(element(stack[0], 'q'));
					}
					else if (re == '<font color="#ff0000">') {
						stack.unshift(element(stack[0], 'mark'));
					}
				}
			}
			else {
				stack[0].appendChild(text(re));
				linkifier.linkify(stack[0]);
			}
		}
	}

	function getExpirationDate (s, fromDate) {
		let Y, M, D, h, m, expireDate;

		if (!(fromDate instanceof Date)) {
			fromDate = new Date;
		}

		if (s instanceof Date) {
			expireDate = s;
			Y = expireDate.getFullYear();
			M = expireDate.getMonth();
			D = expireDate.getDate();
			h = expireDate.getHours();
			m = expireDate.getMinutes();
		}
		else {
			//
			if (s.match(/(\d{4})年/)) {
				Y = RegExp.$1 - 0;
			}
			else if (s.match(/(\d{2})年/)) {
				Y = 2000 + (RegExp.$1 - 0);
			}
			if (s.match(/(\d+)月/)) {
				M = RegExp.$1 - 1;
			}
			if (s.match(/(\d+)日/)) {
				D = RegExp.$1 - 0;
			}
			if (s.match(/(\d+):(\d+)/)) {
				h = RegExp.$1 - 0;
				m = RegExp.$2 - 0;
			}

			// 23:00 -> 01:00頃消えます: treat as next day
			/*if (h != undefined && h < fromDate.getHours() && D == undefined) {
				D = fromDate.getDate() + 1;
			}*/
			// 31日 -> 1日頃消えます: treat as next month
			if (D != undefined && D < fromDate.getDate() && M == undefined) {
				M = fromDate.getMonth() + 1;
			}
			// 12月 -> 1月頃消えます: treat as next year
			if (M != undefined && M < fromDate.getMonth() && Y == undefined) {
				Y = fromDate.getFullYear() + 1;
			}

			//
			expireDate = new Date(
				Y == undefined ? fromDate.getFullYear() : Y,
				M == undefined ? fromDate.getMonth() : M,
				D == undefined ? fromDate.getDate() : D,
				h == undefined ? fromDate.getHours() : h,
				m == undefined ? fromDate.getMinutes() : m
			);
		}

		let expireDateString;
		let remains = expireDate.getTime() - fromDate.getTime();
		if (remains < 0) {
			expireDateString = '?';
		}
		else {
			let remainsString = [];
			[
				[1000 * 60 * 60 * 24, '日',   true],
				[1000 * 60 * 60,      '時間', h != undefined && m != undefined],
				[1000 * 60,           '分',   h != undefined && m != undefined]
			].forEach(unit => {
				if (!unit[2]) return;
				if (remains < unit[0]) return;

				remainsString.push(Math.floor(remains / unit[0]) + unit[1]);
				remains %= unit[0];
			});

			if (remainsString.length == 0) {
				expireDateString = 'まもなく';
			}
			else {
				if (/日/.test(remainsString[0]) && remainsString.length > 1) {
					remainsString[0] += 'と';
				}

				expireDateString = `あと${remainsString.join('')}くらい`;
			}
		}

		return {
			base: fromDate,
			at: expireDate,
			string: expireDateString
		};
	}

	function parseMaxAttachSize (number, unit) {
		switch (unit) {
		case 'KB':
			unit = 1024;
			break;
		case 'MB':
			unit = 1024 * 1024;
			break;
		default:
			unit = 1;
		}

		return (number - 0) * unit;
	}

	function parseMinThreadLifeTime (number, unit) {
		switch (unit) {
		case '分':
			unit = 60;
			break;
		case '時間':
			unit = 3600;
			break;
		default:
			unit = 1;
		}

		return (number - 0) * unit * 1000;
	}

	/*
	 * main functions
	 */

	function run (content = '', maxReplies = 0x7fffffff, isAfterPost = false) {
		timingLogger.startTag('createXMLGenerator#run');

		const url = location.href;
		const isReplyMode = pageModes[0].mode == 'reply';
		const baseUrl = url;
		const remainingRepliesContext = [];
		const xml = createFutabaXML(isReplyMode ? 'reply' : 'summary');
		const text = textFactory(xml);
		const enclosureNode = xml.documentElement;
		const metaNode = $qs('meta', enclosureNode);

		let re;
		if (typeof maxReplies != 'number') {
			maxReplies = 0x7fffffff;
		}

		// strip all control characters and newline characters:
		// LF(U+000A), VT(U+000B), FF(U+000C), CR(U+000D),
		// NEL(U+0085), LS(U+2028) and PS(U+2029)
		content = content.replace(/[\u0000-\u001f\u0085\u2028\u2029]/g, ' ');

		// strip bidi control character references
		content = content.replace(/[\u200e-\u200f\u202a-\u202e]/g, '');

		// base url
		re = /<base[^>]+href="([^"]+)"/i.exec(content);
		if (re) {
			baseUrl = resolveRelativePath(re[1], `${location.protocol}//${location.host}/`);
			element(metaNode, 'base').appendChild(text(re[1]));
		}

		// link to home
		if (content.match(/<a[^>]+href="([^"]+)"[^>]*>ホーム<\/a>/i)) {
			element(metaNode, 'home').appendChild(text(resolveRelativePath(RegExp.$1, baseUrl)));
		}
		if (content.match(/<a[^>]+href="([^"]+)"[^>]*>掲示板に戻る<\/a>/i)) {
			element(metaNode, 'board_top').appendChild(text(resolveRelativePath(RegExp.$1, baseUrl)));
		}

		// page title
		(() => {
			/*
			 * summary page:  "二次元裏＠ふたば"
			 * reply page #1: "これ実際どのぐらいヤ - 二次元裏＠ふたば"
			 * reply page #2: "二次元裏＠ふたば"
			 */
			const re = /([^<>]+\s+-\s+)?([^<>]+)(＠ふたば)/.exec(content);
			if (!re) return;

			let [, titleFragment, boardName, siteName] = re;
			let dash = '';

			// update title
			if (titleFragment) {
				titleFragment = titleFragment.replace(/\s+-\s+$/, '');
				dash = ' ─ ';
			}
			else {
				titleFragment = '';
			}
			// update board name
			boardName = boardName.replace(/二次元裏$/, `虹裏${siteInfo.server}`);
			// update site title
			if (!isReplyMode && siteInfo.summaryIndex) {
				siteName += ` [ページ ${siteInfo.summaryIndex}]`;
			}

			let titleNode = element(metaNode, 'title');
			if (titleFragment) {
				const span1 = element(titleNode, 'span');
				span1.appendChild(text(titleFragment));
				linkifier.linkify(span1, {linkify: false, emojify: true});

				const span2 = element(titleNode, 'span');
				span2.appendChild(text(`${dash}${boardName}${siteName}`));
			}
			else {
				titleNode.appendChild(text(`${boardName}${siteName}`));
			}
		})();

		// page notice
		(() => {
			let notices = /<table[^>]+class="ftbl"[^>]*>(.*?)<\/form>/i.exec(content);
			if (!notices) return;
			notices = notices[1];

			const noticeMarkups = [];
			const noticesNode = element(metaNode, 'notices');
			const noticeRegex = /<li[^>]*>(.*?)<\/li>/g;
			let notice;
			while ((notice = noticeRegex.exec(notices))) {
				notice = notice[1];

				// viewers
				if (notice.match(/現在([^人]+)/)) {
					element(metaNode, 'viewers').appendChild(text(RegExp.$1));
				}

				// log cycle
				if (notice.match(/この板の保存数は(\d+)/)) {
					element(metaNode, 'logsize').appendChild(text(RegExp.$1));
					siteInfo.logSize = RegExp.$1 - 0;
				}

				// max size of attachment file
				if (notice.match(/(\d+)\s*(KB|MB)/)) {
					siteInfo.maxAttachSize = parseMaxAttachSize(RegExp.$1, RegExp.$2);
					element(metaNode, 'maxattachsize').appendChild(text(siteInfo.maxAttachSize));
				}

				// max number of replies
				if (notice.match(/スレッド最大\s*(\d+)\s*レス/)) {
					siteInfo.maxReplies = RegExp.$1 - 0;
					element(metaNode, 'maxReplies').appendChild(text(siteInfo.maxReplies));
				}

				// min life time of thread
				if (notice.match(/最低(\d+)\s*(時間|分)保持/)) {
					siteInfo.minThreadLifeTime = parseMinThreadLifeTime(RegExp.$1, RegExp.$2);
					element(metaNode, 'minthreadlifetime').appendChild(text(siteInfo.minThreadLifeTime));
				}

				notice = stripTagsForNotice(notice);
				element(noticesNode, 'notice').appendChild(text(notice));
				noticeMarkups.push(
					notice
						.replace(/&nbsp;/g, ' ')
						.replace(/>([^<]+)</g, ($0, content) => {
							return '>' + content.replace(/\s+/g, ' ') + '<';
						})
				);
			}

			siteInfo.noticeNew = noticeMarkups
				.join('\n')
				.replace(/現在[^人]+人/g, '現在__akahukuplus_viewers_count__人');
		})();

		// page navigator
		(() => {
			const navs = /<table[^>]+class="psen"[^>]*>(.*)<\/table>/i.exec(content);
			if (!navs) return;
			const buffer = [];

			const navRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
			let nav;
			while ((nav = navRegex.exec(navs[1]))) {
				buffer.push([nav[2] - 0, resolveRelativePath(nav[1], baseUrl)]);
			}

			if (url.match(/(\d+)\.htm(?:[?#].*)?$/)) {
				buffer.push([RegExp.$1 - 0, url, true]);
			}
			else {
				buffer.push([0, url, true]);
			}

			buffer.sort((a, b) => a[0] - b[0]);
			const navsNode = element(metaNode, 'navs');
			for (let i = 0, goal = Math.min(11, buffer.length); i < goal; i++) {
				const navNode = element(navsNode, 'nav');

				navNode.appendChild(text(buffer[i][0]));
				navNode.setAttribute('href', buffer[i][1]);

				if (buffer[i][2]) {
					navNode.setAttribute('current', 'true');

					let linkNode;

					linkNode = element(metaNode, 'link');
					linkNode.setAttribute('rel', 'prev');
					linkNode.appendChild(text(
						buffer[(i - 1 + buffer.length) % buffer.length][1]));

					linkNode = element(metaNode, 'link');
					linkNode.setAttribute('rel', 'next');
					linkNode.appendChild(text(
						buffer[(i + 1 + buffer.length) % buffer.length][1]));
				}
			}
		})();

		// post form metadata
		(() => {
			const postformRegex = /(<form[^>]+enctype="multipart\/form-data"[^>]*>)(.+?)<\/form>/ig;
			let postform;
			while ((postform = postformRegex.exec(content))) {
				if (!/<input[^>]+value="regist"/.test(postform[2])) continue;

				const pfNode = element(metaNode, 'postform');

				// postform attributes
				{
					const attribRegex = /(action|method|enctype)="([^"]*)"/ig;
					let attrib;
					while ((attrib = attribRegex.exec(postform[1]))) {
						pfNode.setAttribute(attrib[1], attrib[2]);
					}
				}

				// input elements
				const inputRegex = /<input[^>]+>/gi;
				let input;
				while ((input = inputRegex.exec(postform[2]))) {
					const inputNode = element(pfNode, 'input');
					const attribRegex = /(type|name|value)="([^"]*)"/ig;
					let attrib;
					while ((attrib = attribRegex.exec(input[0]))) {
						inputNode.setAttribute(attrib[1], attrib[2]);
					}
				}

				break;
			}

		})();

		// ads
		(() => {
			const adsNode = element(metaNode, 'ads');
			const adsHash = {};

			// pick up unique ad iframe list
			const adsRegex = /<iframe([^>]+)>.*?<\/iframe>/gi;
			let ads;
			while ((ads = adsRegex.exec(content))) {
				let width, height, src, re;

				re = /width="(\d+)/i.exec(ads[1]);
				if (re) {
					width = re[1] - 0;
				}

				re = /height="(\d+)/i.exec(ads[1]);
				if (re) {
					height = re[1] - 0;
				}

				re = /src="([^"]+)/i.exec(ads[1]);
				if (re) {
					src = re[1];
				}

				if (!isNaN(width) && !isNaN(height) && src) {
					adsHash[`${width}_${height}_${src}`] = 1;
				}
			}

			// shuffle
			const adsArray = Object.keys(adsHash);
			for (let i = adsArray.length - 1; i > 0; i--) {
				const index = Math.floor(Math.random() * (i + 1));
				const tmp = adsArray[i];
				adsArray[i] = adsArray[index];
				adsArray[index] = tmp;
			}

			// store into xml
			const bannersNode = element(adsNode, 'banners');
			for (let i of adsArray) {
				const parts = i.split('_');
				const width = parts.shift() - 0;
				const height = parts.shift() - 0;
				const src = parts.join('_');
				const adNode = element(bannersNode, 'ad');
				let className = 'unknown';

				if (width == 336) {
					className = 'standard';
				}
				else if (width == 300) {
					className = 'mini';
				}
				else if (width == 728) {
					className = 'large';
				}
				else if (width == 160 && height == 600) {
					className = 'skyscraper';
				}

				i = i.replace(/\bsrc=/, 'src="about:blank" data-src=');

				adNode.setAttribute('class', `size-${className}`);
				adNode.setAttribute('width', width);
				adNode.setAttribute('height', height);
				adNode.setAttribute('src', src);
			}
		})();

		// configurations
		(() => {
			const configNode = element(metaNode, 'configurations');
			const cs = getCatalogSettings();
			let paramNode;

			paramNode = configNode.appendChild(element(configNode, 'param'));
			paramNode.setAttribute('name', 'catalog.x');
			paramNode.setAttribute('value', cs[0]);

			paramNode = configNode.appendChild(element(configNode, 'param'));
			paramNode.setAttribute('name', 'catalog.y');
			paramNode.setAttribute('value', cs[1]);

			paramNode = configNode.appendChild(element(configNode, 'param'));
			paramNode.setAttribute('name', 'catalog.text');
			paramNode.setAttribute('value', cs[2] != 0 ? '1' : '0');

			paramNode = configNode.appendChild(element(configNode, 'param'));
			paramNode.setAttribute('name', 'storage')
			paramNode.setAttribute('value', storage.config.storage.value)

			paramNode = configNode.appendChild(element(configNode, 'param'));
			paramNode.setAttribute('name', 'banner_enabled')
			paramNode.setAttribute('value', storage.config.banner_enabled.value ? '1' : '0')
		})();

		/*
		 * split content into threads
		 */

		const threadRegex = /(<div\s+class="thre"[^>]*>\s*)(?:画像ファイル名：.+?(<a[^>]+><img[^>]+><\/a>))?(?:<input[^>]+value="?delete"?[^>]*>|<span\s+id="delcheck\d+"[^>]*>).*?<hr>/g;
		const postTimeRegex = getPostTimeRegex();
		let threadIndex = 0;

		postStats.start();

		for (let matches; (matches = threadRegex.exec(content)); threadIndex++) {
			const match = matches[0];
			let topic = /^(.+?)<blockquote[^>]*>(.*?)<\/blockquote>(.*)/i.exec(match);
			if (!topic) continue;

			let topicInfo = topic[1];
			let topicInfoText = topicInfo.replace(/<\/?[\w\-:]+(\s+[\w\-:]+\s*=\s*"[^"]*")*\s*>/g, '');
			let threadRest = topic[3];
			topic = topic[2];

			re = /^(.*?)(<table\s+.*)/i.exec(threadRest);
			if (re) {
				topicInfo += ' ' + re[1];
				threadRest = re[2];
			}
			else {
				topicInfo += ' ' + threadRest;
				threadRest = '';
			}

			let htmlref;
			if (isReplyMode) {
				htmlref = /\b(res\/(\d+)\.htm|futaba\.php\?res=(\d+))/.exec(location.href);
			}
			else {
				htmlref = /<a href="(res\/(\d+)\.htm|futaba\.php\?res=(\d+))[^>]*>/i.exec(topicInfo);
			}
			if (!htmlref) continue;

			/*
			 * thread meta informations
			 */

			const threadNode = element(enclosureNode, 'thread');
			threadNode.setAttribute('url', resolveRelativePath(htmlref[1], baseUrl));

			let threadExpireDate;

			/*
			 * topic informations
			 */

			const topicNode = element(threadNode, 'topic');

			// expiration date
			const expires = /<(?:small|span)[^>]*>([^<]+?頃消えます)<\/(?:small|span)>/i.exec(topicInfo);
			const expireWarn = /<font[^>]+><b>このスレは古いので、/i.test(topicInfo);
			const maxReached = /<span\s+class="maxres"[^>]*>[^<]+</i.test(topicInfo);
			if (expires || expireWarn || maxReached) {
				const expiresNode = element(topicNode, 'expires');
				let expireDate;
				if (expires) {
					expireDate = getExpirationDate(expires[1]);
					expiresNode.appendChild(text(expires[1]));
					expiresNode.setAttribute('remains', expireDate.string);
				}
				if (expireDate) {
					threadExpireDate = expireDate.at.getTime();
					passiveTracker.update(expireDate.at);
				}
				else {
					threadExpireDate = Date.now() + 1000 * 60 * 60 * 24;
				}
				if (expireWarn) {
					expiresNode.setAttribute('warned', 'true');
				}
				if (maxReached) {
					expiresNode.setAttribute('maxreached', 'true');
				}
			}

			// number
			let threadNumber = 0;
			if (typeof htmlref[2] == 'string' && htmlref[2] != '') {
				threadNumber = htmlref[2] - 0;
			}
			else if (typeof htmlref[3] == 'string' && htmlref[3] != '') {
				threadNumber = htmlref[3] - 0;
			}
			if (threadNumber) {
				const threadNumberNode = element(topicNode, 'number');
				threadNumberNode.appendChild(text(threadNumber));
				re = /^(\d*?)((\d)\3+)$/.exec(threadNumber);
				if (re) {
					threadNumberNode.setAttribute('lead', re[1]);
					threadNumberNode.setAttribute('trail', re[2]);
				}
				if (threadIndex == 0) {
					siteInfo.latestNumber = threadNumber;
				}
			}

			// posted date
			re = postTimeRegex.exec(topicInfo);
			if (re) {
				const postedDate = new Date(
					2000 + (re[1] - 0),
					re[2] - 1,
					re[3] - 0,
					re[4] - 0,
					re[5] - 0,
					re[6] - 0,
					0
				);
				const postDateNode = element(topicNode, 'post_date');
				postDateNode.appendChild(text(re[0]));
				postDateNode.setAttribute('value', postedDate.getTime());
				if (pageModes[0].mode == 'reply' && !siteInfo.date) {
					siteInfo.date = postedDate;
				}
			}

			// subject
			re = /<span\s+class="[^"]*csb[^"]*"[^>]*>(.+?)<\/span>/i.exec(topicInfo);
			if (re) {
				re[1] = re[1].replace(/^\s+|\s+$/g, '');
				element(topicNode, 'sub').appendChild(text(re[1]));
				siteInfo.subHash[re[1]] = (siteInfo.subHash[re[1]] || 0) + 1;
			}

			// name
			re = /<span\s+class="[^"]*cnm[^"]*"[^>]*>(.+?)<\/span>/i.exec(topicInfo);
			if (re) {
				re[1] = re[1]
					.replace(/<[^>]*>/g, '')
					.replace(/^\s+|\s+$/g, '');
				element(topicNode, 'name').appendChild(text(re[1]));
				siteInfo.nameHash[re[1]] = (siteInfo.nameHash[re[1]] || 0) + 1;
			}

			// mail address
			re = /<a[^>]+href="mailto:([^"]*)"/i.exec(topicInfo);
			if (re) {
				const emailNode = element(topicNode, 'email');
				emailNode.appendChild(text(stripTags(re[1])));
				linkifier.linkify(emailNode);
				if (isReplyMode && /ID表示/i.test(re[1])) {
					siteInfo.idDisplay = true;
				}
			}

			// そうだね (that's right)
			re = /<a[^>]+class="sod"[^>]*>([^<]+)<\/a>/i.exec(topicInfo);
			if (re) {
				/*
				 * +          => sodane-null
				 * そうだねx0 => sodane-null
				 * そうだねxn => sodane
				 */
				const sodaneNode = element(topicNode, 'sodane');
				if (/x\s*([1-9][0-9]*)/.test(re[1])) {
					sodaneNode.appendChild(text(RegExp.$1));
					sodaneNode.setAttribute('class', 'sodane');
					postStats.notifySodane(threadNumber, RegExp.$1);
				}
				else {
					sodaneNode.appendChild(text('＋'));
					sodaneNode.setAttribute('class', 'sodane-null');
					postStats.notifySodane(threadNumber, 0);
				}
			}

			// ID
			re = /<span\s+class="[^"]*cnw[^"]*"[^>]*>.*?ID:(.+?)<\/span>/i.exec(topicInfo) || /ID:([^ <]+)/.exec(topicInfoText);
			if (re) {
				const idNode = element(topicNode, 'user_id');
				idNode.appendChild(text(stripTags(re[1])));
				postStats.notifyId(threadNumber, re[1]);
			}

			// IP
			re = /IP:([a-zA-Z0-9_*:.\-()]+)/.exec(topicInfoText);
			if (re) {
				const ipNode = element(topicNode, 'ip');
				ipNode.appendChild(text(re[1]));
			}

			// src & thumbnail url
			const imagehref = /<br><a[^>]+href="([^"]+)"[^>]*>(<img[^>]+>)<\/a>/i.exec(topicInfo);
			if (imagehref) {
				const imageNode = element(topicNode, 'image');
				const srcUrl = resolveRelativePath(imagehref[1], baseUrl);
				imageNode.appendChild(text(srcUrl));
				imageNode.setAttribute('base_name', imagehref[1].match(/[^\/]+$/)[0]);

				// animated
				re = /<small[^>]*>アニメGIF\.<\/small[^>]*>|<!--AnimationGIF-->/i.exec(topicInfo);
				if (re) {
					imageNode.setAttribute('animated', 'true');
				}

				// bytes
				re = /\balt="?(\d+)\s*B/i.exec(imagehref[2]);
				if (re) {
					imageNode.setAttribute('bytes', re[1]);
					imageNode.setAttribute('size', getReadableSize(re[1]));
				}

				// thumbnail
				let thumbUrl = '', thumbWidth = false, thumbHeight = false;
				re = /\b(?:data-)?src=([^\s>]+)/i.exec(imagehref[2]);
				if (re) {
					thumbUrl = re[1].replace(/^["']|["']$/g, '');
					thumbUrl = resolveRelativePath(thumbUrl, baseUrl);
				}
				re = /\bwidth="?(\d+)"?/i.exec(imagehref[2]);
				if (re) {
					thumbWidth = re[1];
				}
				re = /\bheight="?(\d+)"?/i.exec(imagehref[2]);
				if (re) {
					thumbHeight = re[1];
				}
				if (thumbUrl != '' && thumbWidth !== false && thumbHeight !== false) {
					const thumbNode = element(topicNode, 'thumb');
					const thumbnailSize = getThumbnailSize(thumbWidth, thumbHeight, 250, 250);
					thumbNode.appendChild(text(thumbUrl));
					thumbNode.setAttribute('width', thumbnailSize.width);
					thumbNode.setAttribute('height', thumbnailSize.height);
				}
			}

			// communist sign :-)
			re = /(\[|dice\d+d\d+(?:[-+]\d+)?=)?<font\s+color="#ff0000">(.+?)<\/font>\]?/i.exec(topic);
			if (re && (!re[1] || re[1].substr(-1) != '=')) {
				const markNode = element(topicNode, 'mark');
				re[0].charAt(0) == '['
					&& re[0].substr(-1) == ']'
					&& markNode.setAttribute('bracket', 'true');
				markNode.appendChild(text(stripTags(re[2])));
			}

			// comment
			pushComment(element(topicNode, 'comment'), text, topic);

			// memory some topic infomations
			urlStorage.memo(item => {
				item.expire = threadExpireDate;
				if (isAfterPost) {
					item.count--;
					item.post++;
				}
			});

			/*
			 * replies
			 */

			let hiddenRepliesCount = 0;
			re = /font color="#707070">レス(\d+)件省略。/i.exec(topicInfo);
			if (re) {
				hiddenRepliesCount = re[1] - 0;
			}

			const result = fetchReplies(
				threadRest,
				/<table[^>]*>.*?(?:<input[^>]*>|<span\s+id="delcheck\d+"[^>]*>).*?<\/td>/g,
				hiddenRepliesCount, maxReplies, -1, threadNode,
				siteInfo.subHash, siteInfo.nameHash, baseUrl);

			const lastIndex = result.regex.lastIndex;
			if (!result.lastReached && result.regex.exec(threadRest)) {
				result.regex.lastIndex = lastIndex;
				remainingRepliesContext.push({
					index: threadIndex,
					repliesCount: result.repliesCount,
					regex: result.regex,
					content: threadRest
				});
			}

			/*
			 * misc
			 */

			// if summary mode, store lastest number
			if (pageModes[0].mode == 'summary' && threadIndex == 0) {
				if (result.repliesNode.childElementCount) {
					siteInfo.latestNumber = $qs('number', result.repliesNode.lastElementChild).textContent - 0;
				}
			}

			result.repliesNode.setAttribute("total", result.repliesCount);
			result.repliesNode.setAttribute("hidden", hiddenRepliesCount);
		}

		setDefaultSubjectAndName(xml, text, metaNode, siteInfo.subHash, siteInfo.nameHash);

		timingLogger.endTag();

		if (devMode && ($qs('[data-href="#toggle-dump-xml"]') || {}).checked) {
			console.log(serializeXML(xml));
		}

		return {xml, remainingRepliesContext};
	}

	function fetchReplies (s, regex, hiddenRepliesCount, maxReplies, lowBoundNumber, threadNode, subHash, nameHash, baseUrl) {
		const text = textFactory(threadNode.ownerDocument);
		const repliesNode = element(threadNode, 'replies');
		const goal = hiddenRepliesCount + maxReplies;
		const postTimeRegex = getPostTimeRegex();

		let repliesCount = hiddenRepliesCount;
		let offset = hiddenRepliesCount + 1;
		let reply;

		for (;repliesCount < goal && (reply = regex.exec(s)); offset++, repliesCount++) {
			let re = /^(.*)<blockquote[^>]*>(.*)<\/blockquote>/i.exec(reply[0]);
			if (!re) continue;

			const info = re[1];
			const infoText = info.replace(/<\/?[\w\-:]+(\s+[\w\-:]+\s*=\s*"[^"]*")*[^>]*>/g, '');
			const comment = re[2];
			const replyNode = element(repliesNode, 'reply');
			let number;

			// number
			re = /No\.(\d+)/i.exec(infoText);
			if (re) {
				number = re[1];
				const numberNode = element(replyNode, 'number');
				numberNode.appendChild(text(re[1]));
				re = /^(\d*?)((\d)\3+)$/.exec(number);
				if (re) {
					numberNode.setAttribute('lead', re[1]);
					numberNode.setAttribute('trail', re[2]);
				}
			}

			// deletion flag
			re = /<table[^>]*class="deleted"[^>]*>/i.exec(info);
			if (re) {
				element(replyNode, 'deleted');
			}

			// ID
			re = /<span\s+class="[^"]*cnw[^"]*"[^>]*>.*?ID:([^\s]+)<\/span>/i.exec(info) || /ID:([^ "<]+)/.exec(infoText);
			if (re) {
				const idNode = element(replyNode, 'user_id');
				idNode.appendChild(text(stripTags(re[1])));
				postStats.notifyId(number, re[1]);
			}

			// IP
			re = /IP:([a-zA-Z0-9_*:.\-()]+)/.exec(infoText);
			if (re) {
				const ipNode = element(replyNode, 'ip');
				ipNode.appendChild(text(re[1]));
			}

			// mark
			re = /(\[|dice\d+d\d+(?:[-+]\d+)?=)?<font\s+color="#ff0000">(.+?)<\/font>\]?/i.exec(comment);
			if (re && (!re[1] || re[1].substr(-1) != '=')) {
				if (!$qs('deleted', replyNode)) {
					element(replyNode, 'deleted');
				}

				const markNode = element(replyNode, 'mark');
				if (re[0].charAt(0) == '[' && re[0].substr(-1) == ']') {
					markNode.setAttribute('bracket', 'true');
				}
				re[2] = stripTags(re[2]);
				markNode.appendChild(text(re[2]));
				postStats.notifyMark(number, re[2]);
			}

			// そうだね (that's right)
			re = /<a[^>]+class="sod"[^>]*>([^<]+)<\/a>/i.exec(info);
			if (re) {
				const sodaneNode = element(replyNode, 'sodane');
				if (/x\s*([1-9][0-9]*)/.test(re[1])) {
					const sodaneValue = RegExp.$1;
					sodaneNode.appendChild(text(sodaneValue));
					sodaneNode.setAttribute('class', 'sodane');
					postStats.notifySodane(number, sodaneValue);
				}
				else {
					sodaneNode.appendChild(text('＋'));
					sodaneNode.setAttribute('class', 'sodane-null');
					postStats.notifySodane(number, 0);
				}
			}

			// offset
			element(replyNode, 'offset').appendChild(text(offset));

			// skip, if we can
			if (number <= lowBoundNumber) {
				continue;
			}

			// posted date
			re = postTimeRegex.exec(info);
			if (re) {
				const postedDate = new Date(
					2000 + (re[1] - 0),
					re[2] - 1,
					re[3] - 0,
					re[4] - 0,
					re[5] - 0,
					re[6] - 0,
					0
				);
				const postDateNode = element(replyNode, 'post_date');
				postDateNode.appendChild(text(re[0]));
				postDateNode.setAttribute('value', postedDate.getTime());
			}

			// subject
			re = /<span\s+class="[^"]*csb[^"]*"[^>]*>(.+?)<\/span>/i.exec(info);
			if (re) {
				re[1] = re[1].replace(/^\s+|\s+$/g, '');
				element(replyNode, 'sub').appendChild(text(re[1]));
				subHash[re[1]] = (subHash[re[1]] || 0) + 1;
			}

			// name
			re = /<span\s+class="[^"]*cnm[^"]*"[^>]*>(.+?)<\/span>/i.exec(info);
			if (re) {
				re[1] = re[1]
					.replace(/<[^>]*>/g, '')
					.replace(/^\s+|\s+$/g, '');
				element(replyNode, 'name').appendChild(text(re[1]));
				nameHash[re[1]] = (nameHash[re[1]] || 0) + 1;
			}

			// mail address
			re = /<a[^>]+href="mailto:([^"]*)"/i.exec(info);
			if (re) {
				const emailNode = element(replyNode, 'email');
				emailNode.appendChild(text(stripTags(re[1])));
				linkifier.linkify(emailNode);
			}

			// src & thumbnail url
			const imagehref = /<br><a[^>]+href="([^"]+)"[^>]*>(<img[^>]+>)<\/a>/i.exec(info);
			if (imagehref) {
				const imageNode = element(replyNode, 'image');
				const srcUrl = resolveRelativePath(imagehref[1], baseUrl);
				imageNode.appendChild(text(srcUrl));
				imageNode.setAttribute('base_name', imagehref[1].match(/[^\/]+$/)[0]);

				// animated
				re = /<small[^>]*>アニメGIF\.<\/small[^>]*>|<!--AnimationGIF-->/i.exec(info);
				if (re) {
					imageNode.setAttribute('animated', 'true');
				}

				// bytes
				re = /\balt="?(\d+)\s*B/i.exec(imagehref[2]);
				if (re) {
					imageNode.setAttribute('bytes', re[1]);
					imageNode.setAttribute('size', getReadableSize(re[1]));
				}

				// thumbnail
				let thumbUrl = '', thumbWidth = false, thumbHeight = false;
				re = /\b(?:data-)?src=([^\s>]+)/i.exec(imagehref[2]);
				if (re) {
					thumbUrl = re[1].replace(/^["']|["']$/g, '');
					thumbUrl = resolveRelativePath(thumbUrl, baseUrl);
				}
				re = /\bwidth="?(\d+)"?/i.exec(imagehref[2]);
				if (re) {
					thumbWidth = re[1];
				}
				re = /\bheight="?(\d+)"?/i.exec(imagehref[2]);
				if (re) {
					thumbHeight = re[1];
				}
				if (thumbUrl != '' && thumbWidth !== false && thumbHeight !== false) {
					const thumbNode = element(replyNode, 'thumb');
					const thumbnailSize = getThumbnailSize(thumbWidth, thumbHeight, 250, 250);
					thumbNode.appendChild(text(thumbUrl));
					thumbNode.setAttribute('width', thumbnailSize.width);
					thumbNode.setAttribute('height', thumbnailSize.height);
				}
			}

			// comment
			/*
			if (true) {
				let extraTester = '';
				switch (repliesCount) {
				case 0:
					extraTester = [
						'\n',
						'fu258062'
					].join('<br>');
					break;
				}
				pushComment(element(replyNode, 'comment'), text, comment + extraTester);
			}
			else {
				pushComment(element(replyNode, 'comment'), text, comment);
			}
			*/
			pushComment(element(replyNode, 'comment'), text, comment);
		}

		return {
			lastReached: repliesCount < goal && !reply,
			repliesNode, repliesCount, regex
		}
	}

	function runFromJson (content, hiddenRepliesCount, isAfterPost) {
		timingLogger.startTag('createXMLGenerator#runFromJson');

		const url = location.href;
		const baseUrl = url;
		const xml = createFutabaXML('reply');
		const text = textFactory(xml);
		const enclosureNode = xml.documentElement;
		const metaNode = $qs('meta', enclosureNode);

		/*
		 * thread meta informations
		 */

		const threadNode = element(enclosureNode, 'thread');
		threadNode.setAttribute('url', baseUrl);

		/*
		 * topic informations
		 */

		const topicNode = element(threadNode, 'topic');
		const expiresNode = element(topicNode, 'expires');
		const expireDate = getExpirationDate(new Date(content.dielong));
		expiresNode.appendChild(text(`${content.die}頃消えます`));
		expiresNode.setAttribute('remains', expireDate.string);
		urlStorage.memo(item => {
			item.expire = expireDate.at.getTime();
			if (isAfterPost) {
				item.count--;
				item.post++;
			}
		});
		passiveTracker.update(expireDate.at);

		if (content.maxres && content.maxres != '') {
			expiresNode.setAttribute('maxreached', 'true');
		}

		/*
		 * replies
		 */

		postStats.start();

		const repliesNode = element(threadNode, 'replies');
		let offset = hiddenRepliesCount || 0;
		for (const replyNumber in content.res) {
			const reply = content.res[replyNumber];

			offset++;
			const replyNode = element(repliesNode, 'reply');

			// number
			{
				const numberNode = element(replyNode, 'number');
				numberNode.appendChild(text(replyNumber));

				let re = /^(\d*?)((\d)\3+)$/.exec(replyNumber);
				if (re) {
					numberNode.setAttribute('lead', re[1]);
					numberNode.setAttribute('trail', re[2]);
				}
			}

			// deletion flag, mark
			{
				let re;
				if (reply.host) {
					re = [
						`[<font color="#ff0000">${reply.host}</font>]`,
						`[<font color="#ff0000">${reply.host}</font>]`,
						reply.host
					];
				}
				else {
					re = /(\[|dice\d+d\d+=)?<font\s+color="#ff0000">(.+?)<\/font>\]?/i.exec(reply.com);
				}
				if (re && (!re[1] || re[1].substr(-1) != '=')) {
					if (!$qs('deleted', replyNode)) {
						element(replyNode, 'deleted');
					}

					const markNode = element(replyNode, 'mark');
					if (re[0].charAt(0) == '[' && re[0].substr(-1) == ']') {
						markNode.setAttribute('bracket', 'true');
					}
					re[2] = stripTags(re[2]);
					markNode.appendChild(text(re[2]));
					postStats.notifyMark(replyNumber, re[2]);
				}
			}

			// ID
			if (reply.id != '') {
				const id = reply.id.replace(/^id:\s*/i, '');
				if (/^ip:\s*/i.test(id)) {
					const ipNode = element(replyNode, 'ip');
					ipNode.appendChild(text(id.replace(/^ip:\s*/i, '')));
				}
				else {
					const idNode = element(replyNode, 'user_id');
					idNode.appendChild(text(id));
					postStats.notifyId(replyNumber, id);
				}
			}

			// sodane
			if (content.dispsod - 0) {
				const sodaneNode = element(replyNode, 'sodane');
				if (replyNumber in content.sd) {
					sodaneNode.appendChild(text(content.sd[replyNumber]));
					sodaneNode.setAttribute('class', 'sodane');
				}
				else {
					sodaneNode.appendChild(text(`＋`));
					sodaneNode.setAttribute('class', 'sodane-null');
				}
			}

			// offset
			element(replyNode, 'offset').appendChild(text(offset));

			// posted date
			{
				const postedDate = new Date(reply.tim - 0);
				const postDateNode = element(replyNode, 'post_date');
				postDateNode.appendChild(text(reply.now.replace(/<[^>]*>/g, '')));
				postDateNode.setAttribute('value', postedDate.getTime());
			}

			// subject and name
			if (content.dispname - 0) {
				if (reply.sub != '') {
					element(replyNode, 'sub').appendChild(text(reply.sub));
					siteInfo.subHash[reply.sub] = (siteInfo.subHash[reply.sub] || 0) + 1;
				}

				if (reply.name != '') {
					element(replyNode, 'name').appendChild(text(reply.name));
					siteInfo.nameHash[reply.name] = (siteInfo.nameHash[reply.name] || 0) + 1;
				}
			}

			// mail address
			if (reply.email != '') {
				const emailNode = element(replyNode, 'email');
				emailNode.appendChild(text(stripTags(reply.email)));
				linkifier.linkify(emailNode);
			}

			// src & thumbnail url
			if (reply.ext != '') {
				const imageNode = element(replyNode, 'image');
				const srcUrl = resolveRelativePath(reply.src, baseUrl);
				imageNode.appendChild(text(srcUrl));
				imageNode.setAttribute('base_name', reply.src.match(/[^\/]+$/)[0]);

				// animated
				if (/<!--AnimationGIF-->/i.test(reply.now)) {
					imageNode.setAttribute('animated', 'true');
				}

				// bytes
				{
					imageNode.setAttribute('bytes', reply.fsize);
					imageNode.setAttribute('size', getReadableSize(reply.fsize));
				}

				// thumbnail
				if (reply.thumb != '') {
					let thumbUrl = resolveRelativePath(reply.thumb, baseUrl);

					const thumbNode = element(replyNode, 'thumb');
					const thumbnailSize = getThumbnailSize(reply.w, reply.h, 250, 250);
					thumbNode.appendChild(text(thumbUrl));
					thumbNode.setAttribute('width', thumbnailSize.width);
					thumbNode.setAttribute('height', thumbnailSize.height);
				}
			}

			pushComment(element(replyNode, 'comment'), text, reply.com);
		}

		/*
		 * sodane
		 */

		if (content.dispsod - 0) {
			for (const n in content.sd) {
				postStats.notifySodane(n, content.sd[n]);
			}
		}

		repliesNode.setAttribute("total", offset);
		repliesNode.setAttribute("hidden", hiddenRepliesCount);
		setDefaultSubjectAndName(xml, text, metaNode, siteInfo.subHash, siteInfo.nameHash);

		if (devMode && ($qs('[data-href="#toggle-dump-xml"]') || {}).checked) {
			console.log(serializeXML(xml));
		}

		return {delta: offset - hiddenRepliesCount, xml};
	}

	function remainingReplies (context, maxReplies, lowBoundNumber, callback1, callback2) {
		timingLogger.startTag('createXMLGenerator#remainingReplies');

		const url = location.href;

		function main () {
			timingLogger.startTag('creating fragment of replies');
			const xml = createFutabaXML('reply');
			const text = textFactory(xml);
			const result = fetchReplies(
				context[0].content,
				context[0].regex,
				context[0].repliesCount,
				maxReplies,
				lowBoundNumber,
				element(xml.documentElement, 'thread'),
				siteInfo.subHash, siteInfo.nameHash, url);

			result.repliesNode.setAttribute("total", result.repliesCount);
			result.repliesNode.setAttribute("hidden", context[0].repliesCount);
			setDefaultSubjectAndName(xml, text, $qs('meta', xml.documentElement), siteInfo.subHash, siteInfo.nameHash);
			timingLogger.endTag();

			timingLogger.startTag('intermediate call back');
			callback1(xml, context[0].index, result.repliesCount, context[0].repliesCount);
			timingLogger.endTag();

			const lastIndex = context[0].regex.lastIndex;
			if (!result.lastReached && context[0].regex.exec(context[0].content)) {
				context[0].regex.lastIndex = lastIndex;
				context[0].repliesCount = result.repliesCount;
			}
			else {
				context.shift();
			}

			if (context.length) {
				setTimeout(main, REST_REPLIES_PROCESS_INTERVAL);
			}
			else {
				timingLogger.startTag('final call back');
				callback2();
				timingLogger.endTag();

				timingLogger.endTag();
			}
		}

		if (context.length) {
			main();
		}
		else {
			timingLogger.startTag('final calling back');
			callback2();
			timingLogger.endTag();

			timingLogger.endTag();
		}
	}

	return {run, remainingReplies, runFromJson};
}

function createPersistentStorage () {
	/*
	 * NOTE: the 'desc' property will be treated as HTML fragment.
	 */
	const data = {
		wheel_reload_unit_size: {
			type:'int',
			value:120,
			name:'ホイールの1目盛りの単位移動量',
			desc:`通常は120だった気がするけど, 環境によってはもっと小さい値かもしれません。
右のテキストボックス上でホイールを回すと移動量が表示されるので, それらのうち最小の正の値を入力してください。`,
		},
		wheel_reload_threshold_override: {
			type:'int',
			value:3,
			name:'ホイールリロード発動量',
			desc:'ページ末尾で何回ホイールを回したときリロードを行うかを指定する',
			min:1
		},
		catalog_popup_enabled: {
			type:'bool',
			value:true,
			name:'カタログでサムネをポップアップ'
		},
		catalog_text_max_length: {
			type:'int',
			value:CATALOG_TEXT_MAX_LENGTH,
			name:'カタログで取得する本文の長さ',
			min:0
		},
		catalog_thumbnail_scale: {
			type:'float',
			value:1.0,
			name:'カタログのサムネイルの表示倍率',
			min:1.0, max:2.0
		},
		storage: {
			type:'list',
			value:'fsa',
			name:'使用するストレージ',
			list:{
				fsa:'local (FileSystemAccess)',
				dropbox:'dropbox - サポート終了',
				googledrive:'Google Drive - サポート終了',
				onedrive:'Microsoft OneDrive - サポート終了',
				local:'local (ChromeApps) - サポート終了'
			},
			desc:`localストレージをまだサポートしてないブラウザもあります。`
		},
		save_thread_name_template: {
			type:'string',
			value:'$SERVER/$BOARD/$THREAD.$EXT',
			name:'保存するスレッドのパス名のテンプレート',
			desc:`以下のマクロを使用できます:
<ul>
	<li>$SERVER (サーバ名)</li>
	<li>$BOARD (板名)</li>
	<li>$THREAD (スレッド番号)</li>
	<li>$YEAR (スレッドの投稿年)</li>
	<li>$MONTH (スレッドの投稿月)</li>
	<li>$DAY (スレッドの投稿日)</li>
	<li>$TEXT (スレッド本文)</li>
	<li>$TEXT2 (レス、またはスレッド本文)</li>
	<li>$EXT (拡張子)</li>
</ul>`
		},
		save_image_kokoni_name_template: {
			type:'string',
			value:'$SERVER-$BOARD-$SERIAL.$EXT',
			name:'画像、動画などを「ここに保存」する際のファイル名のテンプレート',
			desc:`以下のマクロを使用できます:
<ul>
	<li>$SERVER (サーバ名)</li>
	<li>$BOARD (板名)</li>
	<li>$THREAD (スレッド番号)</li>
	<li>$YEAR (画像の投稿年)</li>
	<li>$MONTH (画像の投稿月)</li>
	<li>$DAY (画像の投稿日)</li>
	<li>$SERIAL (画像番号)</li>
	<li>$TEXT (スレッド本文)</li>
	<li>$TEXT2 (レス、またはスレッド本文)</li>
	<li>$EXT (拡張子)</li>
</ul>
このテンプレートにはパスを含めることはできません。`
		},
		save_image_name_template: {
			type:'string',
			value:'$SERVER/$BOARD/$SERIAL.$EXT',
			name:'画像、動画などを保存する際のパス名のテンプレート',
			desc:`「ここに保存」用のテンプレートと同様のマクロを使用できます。
このテンプレートにはパスを含めることができます。`
		},
		save_image_text_max_length: {
			type:'int',
			value:50,
			name:'ファイル名中のスレッド本文の最大長',
			min:10, max:100
		},
		auto_save_image: {
			type:'bool',
			value:false,
			name:'画像を開いた際に自動的に保存'
		},
		save_image_bell_volume: {
			type:'int',
			value:50,
			name:'画像保存が成功した際のベルの音量',
			min:0, max:100
		},
		lightbox_enabled: {
			type:'bool',
			value:true,
			name:'画像を lightbox で表示'
		},
		lightbox_zoom_mode: {
			type:'list',
			value:'whole',
			name:'lightbox で表示する際の初期倍率',
			list:{
				'whole':'全体',
				'actual-size':'実寸',
				'fit-to-width':'幅に合わせる',
				'fit-to-height':'高さに合わせる',
				'last':'最後に使用した倍率を使用する'
			}
		},
		banner_enabled: {
			type:'bool',
			value:true,
			name:'バナーを表示'
		},
		hook_space_key: {
			type:'bool',
			value:true,
			name:'スペースキーによるスクロールを制御'
		},
		hook_edit_shortcuts: {
			type:'bool',
			value:true,
			name:'テキスト入力時に Emacs ぽいショートカットを使用'
		},
		full_reload_interval: {
			type:'int',
			value:2,
			name:'フルリロードする間隔(分)',
			min:0, max:60
		},
		full_reload_after_post: {
			type:'bool',
			value:false,
			name:'レス送信後にフルリロード'
		},
		tegaki_max_width: {
			type:'int',
			value:400,
			name:'手書きキャンバスの最大の幅',
			min:1,max:1000
		},
		tegaki_max_height: {
			type:'int',
			value:400,
			name:'手書きキャンバスの最大の高さ',
			min:1,max:1000
		},
		autotrack_expect_replies: {
			type:'int',
			value:5,
			name:'自動追尾時に待機するレス数',
			desc:'このレス数がつくと思われる時間だけ自動追尾を待機します',
			min:1,max:10
		},
		autotrack_sampling_replies: {
			type:'int',
			value:10,
			name:'自動追尾時のサンプルレス数',
			desc:'待機時間を算出するために参照する既存レス群のサンプル数',
			min:3,max:30
		},
		quick_moderation: {
			type:'bool',
			value:true,
			name:'del リンククリックで直接 del を送信する'
		},
		osaka_conversion: {
			type:'bool',
			value:false,
			name:'なりきり関西人'
		}
	};
	let runtime = {
		del: {
			lastReason: ''
		},
		lightbox: {
			zoomMode: 'whole'
		},
		catalog: {
			sortOrder: 'default'
		},
		media: {
			volume: 0.2
		},
		kokoni: {
			lru: [],
			treeCache: null
		}
	};
	let onChanged;
	let saveRuntimeTimer;

	function validate (name, value) {
		if (!(name in data)) return;

		switch (data[name].type) {
		case 'int':
			value = parseInt(value, 10);
			if (isNaN(value)) return;
			if ('min' in data[name] && value < data[name].min) return;
			if ('max' in data[name] && value > data[name].max) return;
			break;
		case 'float':
			value = parseFloat(value);
			if (isNaN(value)) return;
			if ('min' in data[name] && value < data[name].min) return;
			if ('max' in data[name] && value > data[name].max) return;
			break;
		case 'bool':
			if (value === '0' || value === false) value = false;
			else if (value === '1' || value === true) value = true;
			else return;
			break;
		case 'string':
			value = '' + value;
			break;
		case 'list':
			const keys = Object.keys(data[name].list);
			if (keys.indexOf(value) < 0) {
				value = keys[0];
			}
			break;
		default:
			return;
		}

		return value;
	}

	function handleChanged (changes, areaName) {
		if (onChanged) {
			onChanged(changes, areaName);
		}
	}

	function saveConfig () {
		const config = {};

		for (let i in data) {
			if (data[i].value != data[i].defaultValue) {
				config[i] = data[i].value;
			}
		}

		setSynced({config: config});
	}

	function assignConfig (storage) {
		if (!storage) return;

		for (let i in storage) {
			if (!(i in data)) continue;
			const value = validate(i, storage[i]);
			if (value != undefined) {
				data[i].value = value;
			}
		}
	}

	function resetConfig () {
		for (let i in data) {
			data[i].value = data[i].defaultValue;
		}
	}

	function getAllConfig () {
		const result = {};
		for (let i in data) {
			result[i] = data[i].value;
		}
		return result;
	}

	function getAllConfigDefault () {
		const result = {};
		for (let i in data) {
			result[i] = data[i].defaultValue;
		}
		return result;
	}

	function saveRuntime () {
		if (saveRuntimeTimer) {
			clearTimeout(saveRuntimeTimer);
		}
		saveRuntimeTimer = setTimeout(() => {
			saveRuntimeTimer = undefined;
			setLocal({runtime: runtime});
		}, 1000);
	}

	function assignRuntime (storage) {
		runtime = storage;
	}

	function setSynced (items) {
		return new Promise(resolve => {
			chrome.storage.onChanged.removeListener(handleChanged);
			chrome.storage.sync.set(items, () => {
				if (chrome.runtime.lastError) {
					console.error(`${APP_NAME}: storage#setSynced: ${chrome.runtime.lastError.message}`);
				}
				chrome.storage.onChanged.addListener(handleChanged);
				resolve();
			});
		});
	}

	function setLocal (items) {
		return new Promise(resolve => {
			chrome.storage.onChanged.removeListener(handleChanged);
			chrome.storage.local.set(items, () => {
				if (chrome.runtime.lastError) {
					console.error(`${APP_NAME}: storage#setLocal: ${chrome.runtime.lastError.message}`);
				}
				chrome.storage.onChanged.addListener(handleChanged);
				resolve();
			});
		});
	}

	function assignChangedHandler (f) {
		if (typeof f === 'function') {
			onChanged = f;
		}
	}

	function init () {
		for (let i in data) {
			data[i].defaultValue = data[i].value;
		}

		chrome.storage.onChanged.addListener(handleChanged);
	}

	init();
	return {
		saveConfig, assignConfig, resetConfig, getAllConfig, getAllConfigDefault,
		saveRuntime, assignRuntime,
		setSynced, setLocal, assignChangedHandler,
		get config () {return data},
		get runtime () {return runtime}
	};
}

function createTimingLogger () {
	const stack = [];
	const logs = [];
	let last = false;
	let locked = false;
	function timeOffset (now) {
		if (last === false) {
			return now;
		}
		else {
			return ('            +' + (now - last)).substr(-13);
		}
	}
	return {
		startTag: function (message, appendix) {
			if (locked) return;
			const now = Date.now();
			const item = {time:now, message: message};
			logs.push(
				'[start]\t' +
				timeOffset(now) + '\t' +
				'                    '.substring(0, stack.length * 2) +
				item.message +
				(appendix ? ': ' + appendix : ''));
			stack.push(item);
			last = now;
		},
		endTag: function (message) {
			if (locked) return;
			const item = stack.pop();
			if (!item) return;
			const now = Date.now();
			logs.push(
				`[done]\t` +
				`${timeOffset(now)}\t` +
				'                    '.substring(0, stack.length * 2) +
				item.message +
				(message ? (' ' + message) : '') +
				` (${(now - item.time).toFixed(4)} msecs)`);
			if (stack.length == 0) {
				devMode && console.log(`*** timing dump ***\n${this.dump()}\n\n${getVersion()}`);
				this.reset();
			}
			last = now;
			return true;
		},
		reset: function () {
			stack.length = logs.length = 0;
			last = false;
			return this;
		},
		forceEndTag: function () {
			while (this.endTag());
		},
		dump: function () {
			if (locked) return;
			return logs.join('\n');
		},
		get locked () {
			return locked;
		},
		set locked (v) {
			locked = !!v;
		}
	};
}

function createClickDispatcher () {
	const PASS_THROUGH = 'passthrough';
	const keys = {};

	function handler (e) {
		let t = e.target, fragment;
		while (t) {
			let code = t.nodeName;
			if (code == 'INPUT') {
				code += '-' + t.type;
			}
			if (/^(?:a|button|input-checkbox|input-radio)$/i.test(code)) {
				break;
			}
			if (t.getAttribute && (fragment = t.getAttribute('data-href')) != null) {
				break;
			}
			t = t.parentNode;
		}
		if (!t) {
			return;
		}
		if (fragment == null) {
			fragment = t.getAttribute('href');
			if (fragment == null) {
				fragment = t.getAttribute('data-href');
			}
		}
		if (fragment == null) {
			return;
		}

		if (/^#.+$/.test(fragment)) {
			if (fragment in keys) {
				invoke(fragment, e, t);
				return;
			}
		}

		for (let i in keys) {
			if (i.charAt(0) == '.' && t.classList.contains(i.substring(1))) {
				invoke(i, e, t);
				return;
			}
		}

		if ('*noclass*' in keys) {
			keys['*noclass*'](e, t);
		}
	}

	function invoke (fragment, e, t) {
		let result;
		try {
			result = keys[fragment](e, t);
		}
		catch (e) {
			console.error(`${APP_NAME}: exception in clickDispatcher: ${e.stack}`);
			result = undefined;
		}

		let isAnchor = false;
		for (let elm = e.target; elm; elm = elm.parentNode) {
			if (elm.nodeName == 'A') {
				isAnchor = true;
				break;
			}
		}

		if (isAnchor && result !== PASS_THROUGH) {
			e.preventDefault();
			e.stopPropagation();
		}
	}

	function add (key, handler) {
		keys[key] = handler;
		return this;
	}

	function remove (key) {
		delete keys[key];
		return this;
	}

	document.body.addEventListener('click', handler, false);

	return {add, remove, PASS_THROUGH};
}

function createKeyManager () {
	const PASS_THROUGH = 'passthrough';
	const ASIS_KEY_MAP = {
		'Backspace': '\u0008',
		'Tab': '\u0009',
		'Enter': '\u000d',
		'Escape': '\u001b',
		'Delete': '\u007f'
	};
	const CONTROL_KEY_MAP = {
		'@': '\u0000', a: '\u0001', b: '\u0002', c: '\u0003', d: '\u0004', e: '\u0005', f: '\u0006', g: '\u0007',
		h: '\u0008', i: '\u0009', j: '\u000a', k: '\u000b', l: '\u000c', m: '\u000d', n: '\u000e', o: '\u000f',
		p: '\u0010', q: '\u0011', r: '\u0012', s: '\u0013', t: '\u0014', u: '\u0015', v: '\u0016', w: '\u0017',
		x: '\u0018', y: '\u0019', z: '\u001a', '[': '\u001b', '\\': '\u001c', ']': '\u001d', '^': '\u001e', '_': '\u001f'
	};
	const STROKE_TRANSLATE_MAP = {
		' ': 'space'
	};

	const strokes = {};

	function keydown (e) {
		if (/^(?:Control|Shift|Alt|Meta)$/.test(e.key)) return;

		const stroke = getKeyStroke(e);
		const focusedNodeName = getDetailedNodeName(e.target);
		const mode = appStates[0] + (isTextInputElement(focusedNodeName) ? '.edit' : '');

		/*
		dlog([
			` focus: "${focusedNodeName}"`,
			`target: ${getNodeSummary(e.target)}`,
			`  mode: "${mode}"`,
			`  code: "${e.code}"`,
			`   key: "${e.key}"`,
			`   mod: ${getModifiers(e).join(',')}`,
			`stroke: "${toReadableString(stroke)}"`
		].join('\n'));
		*/

		if (e.isComposing) {
			return;
		}

		if ((stroke == 'Enter' || stroke == 'Escape')
		&& isSpecialInputElement(focusedNodeName)) {
			return;
		}

		if (!(mode in strokes) || !(stroke in strokes[mode])) {
			return;
		}

		let result;
		try {
			result = strokes[mode][stroke].handler(e);
		}
		catch (err) {
			console.error(`${APP_NAME}: exception in keyManager: ${err.message}\n${err.stack}`);
			result = undefined;
		}
		if (result !== PASS_THROUGH) {
			e.preventDefault();
		}
	}

	function getModifiers (e, components = []) {
		e.shiftKey && components.push('S');
		e.ctrlKey  && components.push('C');
		e.altKey   && components.push('A');
		return components;
	}

	function getKeyStroke (e) {
		const modifierBits = (e.shiftKey ? 0x80 : 0) |
							 (e.ctrlKey  ? 0x40 : 0) |
							 (e.altKey   ? 0x20 : 0);
		let key = e.key;
		let result;

		switch (modifierBits) {
		case 0:
			result = ASIS_KEY_MAP[key] || key;
			break;

		case 0x40:
			// turn control character strokes with ctrl key into themselves
			result = CONTROL_KEY_MAP[key];
			break;

		case 0x80:
			// use visible characters as they are (except space)
			if (key.length == 1 && key != ' ') {
				result = key;
				break;
			}
		}

		if (!result) {
			const components = getModifiers(e);
			components.push(STROKE_TRANSLATE_MAP[key] || key);
			result = `<${components.join('-')}>`.toLowerCase();
		}

		return result;
	}

	function getDetailedNodeName (target) {
		const el = target || document.activeElement;
		let focusedNodeName = el.nodeName.toLowerCase();
		if (focusedNodeName == 'input') {
			focusedNodeName += `.${el.type.toLowerCase()}`;
		}
		else if (el.isContentEditable) {
			focusedNodeName += '.contentEditable';
		}
		return focusedNodeName;
	}

	function isSpecialInputElement (name) {
		return /^(?:input\.(?:submit|reset|checkbox|radio|file)|button)$/.test(name);
	}

	function isTextInputElement (name) {
		return /^(?:textarea|input\.(?:text|password)|[^.]+\.contentEditable)$/.test(name);
	}

	function addStroke (mode, stroke, handler) {
		if (!(mode in strokes)) {
			strokes[mode] = {};
		}
		if (!(stroke instanceof Array)) {
			stroke = [stroke];
		}
		stroke.forEach(s => {
			strokes[mode][s.toLowerCase()] = {handler};
		});
		return this;
	}

	function removeStroke (mode, stroke) {
		if (mode in strokes) {
			if (stroke == undefined) {
				delete strokes[mode];
			}
			else {
				if (!(stroke instanceof Array)) {
					stroke = [stroke];
				}
				stroke.forEach(s => {
					delete strokes[mode][s.toLowerCase()];
				});
				if (Object.keys(strokes[mode]).length == 0) {
					delete strokes[mode];
				}
			}
		}
		return this;
	}

	document.addEventListener('keydown', keydown, true);

	return {addStroke, removeStroke, PASS_THROUGH};
}

function createSound (name, volume) {
	volume || (volume = 50);
	return {
		play: function play () {
			if (volume <= 0) return;
			backend.send('play-sound', {
				key: name,
				volume: volume
			});
		},
		get volume () {
			return volume;
		},
		set volume (v) {
			v = parseInt(v, 10);
			if (!isNaN(v) && v >= 0 && v <= 100) {
				volume = v;
			}
		}
	}
}

function createPostStats () {
	const KEY_MAP = {
		'管理人': 'admin',
		'なー': 'nar',
		'スレッドを立てた人によって削除されました': 'passive',
		'書き込みをした人によって削除されました': 'active',
		'削除依頼によって隔離されました': 'isolated'
	};

	const data = createData();
	let newData;
	let repliesCount;
	let lastStats;

	function createData () {
		return {
			marks: {
				admin: {},
				nar: {},
				passive: {},
				active: {},
				isolated: {}
			},
			otherMarks: {},
			ids: {},
			sodanes: {}
		};
	}

	function notifyMark (number, content) {
		const key = KEY_MAP[content];
		if (key) {
			if (!(number in data.marks[key])) {
				newData.marks[key][number] = 1;
			}
			data.marks[key][number] = 1;
		}
		else {
			if (!(content in data.otherMarks)) {
				data.otherMarks[content] = {};
				newData.otherMarks[content] = {};
			}
			if (!(number in data.otherMarks[content])) {
				newData.otherMarks[content] = newData.otherMarks[content] || {};
				newData.otherMarks[content][number] = 1;
			}
			data.otherMarks[content][number] = 1;
		}
	}

	function notifyId (number, id) {
		if (!(id in data.ids)) {
			data.ids[id] = {};
			newData.ids[id] = {};
		}
		if (!(number in data.ids[id])) {
			newData.ids[id] = newData.ids[id] || {};
			newData.ids[id][number] = 1;
		}
		data.ids[id][number] = 1;
	}

	function notifySodane (number, value) {
		value = value - 0;
		if (isNaN(value)) return;

		if (number in data.sodanes) {
			if (data.sodanes[number] != value) {
				newData.sodanes[number] = [data.sodanes[number], value];
			}
			if (value) {
				data.sodanes[number] = value;
			}
			else {
				delete data.sodanes[number];
			}
		}
		else {
			if (value) {
				newData.sodanes[number] = [0, value];
				data.sodanes[number] = value;
			}
		}
	}

	function start () {
		newData = createData();
		repliesCount = getRepliesCount();
	}

	function done (dropDelta) {
		const extMarks = new Set;
		const newMarks = new Set;
		const extIds = new Set;
		const newIds = new Set;
		const currentRepliesCount = getRepliesCount();

		function getMarkData () {
			const result = new Map;

			for (let type in data.marks) {
				const item = [];
				for (let number in data.marks[type]) {
					const isNew = number in newData.marks[type];
					if (isNew) {
						newMarks.add(number);
					}
					extMarks.add(number);
					item.push({isNew, number});
				}
				result.set(type, item);
			}

			return result;
		}

		function getOtherMarkData () {
			const result = new Map;

			for (let host in data.otherMarks) {
				const item = [];
				for (let number in data.otherMarks[host]) {
					const isNew = newData.otherMarks[host] && number in newData.otherMarks[host];
					if (isNew) {
						newMarks.add(number);
					}
					extMarks.add(number);
					item.push({isNew, number});
				}
				result.set(host, item);
			}

			return result;
		}

		function getIdData () {
			const result = new Map;

			for (let id in data.ids) {
				const item = [];
				let newIdCount = 0;
				for (let number in data.ids[id]) {
					const isNew = id in newData.ids && number in newData.ids[id];
					isNew && newIdCount++;
					extIds.add(id);
					item.push({isNew, number});
				}

				if (item.length && item.length == newIdCount) {
					newIds.add(id);
				}

				result.set(id, item);
			}

			return result;
		}

		function getSodaneDelta () {
			const result = [];

			for (const number in newData.sodanes) {
				const [oldValue, value] = newData.sodanes[number];
				result.push({number, value, oldValue});
			}

			return result;
		}

		return lastStats = {
			idDisplay: siteInfo.idDisplay,

			markData: getMarkData(),
			otherMarkData: getOtherMarkData(),
			idData: getIdData(),

			count: {
				total: currentRepliesCount,
				mark: extMarks.size,
				id: extIds.size
			},

			delta: {
				total: dropDelta ? 0 : currentRepliesCount - repliesCount,
				mark: dropDelta ? 0 : newMarks.size,
				id: dropDelta ? 0 : newIds.size,
				sodane: dropDelta ? [] : getSodaneDelta()
			}
		};
	}

	function updatePanelView (stats) {
		if (pageModes[0].mode != 'reply') return;

		function setListItemVisibility (node, value) {
			while (node && node.nodeName != 'LI') {
				node = node.parentNode;
			}
			if (node) {
				if (value) {
					node.classList.remove('hide');
				}
				else {
					node.classList.add('hide');
				}
				return node;
			}
		}

		function outputSubHeader (container, label, count) {
			const p = container.appendChild(document.createElement('p'));
			p.classList.add('sub-header');
			p.textContent = label;

			const pp = p.appendChild(document.createElement('span'));
			pp.appendChild(document.createTextNode(`(${count} 回)`));
		}

		function outputArray (container, a) {
			for (let i = 0; i < a.length; i++) {
				container.appendChild(document.createTextNode(' '));
				const anchor = container.appendChild(document.createElement('a'));
				anchor.href = '#search-item';
				anchor.textContent = `No.${a[i].number}`;
				anchor.setAttribute('data-number', a[i].number);
				a[i].isNew && anchor.classList.add('new');
			}
		}

		if (!stats) {
			stats = lastStats;
		}

		const {markData, otherMarkData, idData} = stats;
		let container;

		// known marks
		for (let [type, item] of markData) {
			container = $(`stat-${type}`);
			if (container) {
				empty(container);
				if (item.length) {
					const li = setListItemVisibility(container, true);
					if (li) {
						const header = $qs('p span', li);
						if (header) {
							header.textContent = ` (${item.length})`;
						}
					}
					outputArray(container, item);
				}
				else {
					setListItemVisibility(container, false);
				}
			}
		}

		// other marks
		container = $('stat-other');
		if (container) {
			empty(container);
			if (otherMarkData.size) {
				setListItemVisibility(container, true);
				for (let [host, item] of otherMarkData) {
					outputSubHeader(container, host, item.length);
					outputArray(container, item);
				}
			}
			else {
				setListItemVisibility(container, false);
			}
		}

		// ids
		container = $('stat-id');
		if (container) {
			empty(container);
			if (idData.size) {
				$t('stat-id-header', `(${idData.size} ID)`);
				for (let [id, item] of idData) {
					const li = container.appendChild(document.createElement('li'));
					outputSubHeader(li, id, item.length);
					const div = li.appendChild(document.createElement('div'));
					outputArray(div, item);
				}
			}
			else {
				$t('stat-id-header', '');
			}
		}
	}

	function updatePostformView (stats) {
		let marked = false;
		let identified = false;

		if (!stats) {
			stats = lastStats;
		}

		for (let i in stats.count) {
			const current = stats.count[i];
			let diff;

			if (!stats.delta || (diff = stats.delta[i]) == undefined || diff == 0) {
				$t(`replies-${i}`, current);
				$t(`pf-replies-${i}`, current);
				continue;
			}

			const s = `${current}(${diff > 0 ? '+' : ''}${diff})`;
			$t(`replies-${i}`, s);
			$t(`pf-replies-${i}`, s);

			if (i == 'mark') {
				marked = true;
			}
			else if (i == 'id') {
				identified = true;
			}
		}

		if (identified) {
			if (siteInfo.server == 'may' && siteInfo.board == 'id') {
				identified = false;
			}
			else if (siteInfo.idDisplay) {
				identified = false;
			}
		}

		if (marked) {
			sounds.detectNewMark.play();
		}

		if (identified) {
			sounds.identified.play();
		}

		return marked || identified;
	}

	function resetPostformView () {
		[
			'replies-total', 'replies-mark', 'replies-id',
			'pf-replies-total', 'pf-replies-mark', 'pf-replies-id'
		].forEach(id => {
			const e = $(id);
			if (!e) return;
			$t(e, e.textContent.replace(/\([-+]?\d+\)$/, ''));
		});
	}

	function dump (stats) {
		function mapToObject (map) {
			const result = {};
			for (const [key, value] of map) {
				result[key] = value;
			}
			return result;
		}

		if (!stats) {
			stats = lastStats;
		}

		const result = ['*** internal data ***'];
		result.push(JSON.stringify(data, null, '    '));
		result.push('*** snapshot stats ***');
		result.push(JSON.stringify(stats, (key, value) => {
			if (value instanceof Set) {
				return Array.from(value);
			}
			if (value instanceof Map) {
				return mapToObject(value);
			}
			return value;
		}, '    '));

		return result.join('\n');
	}

	return {
		start, done, notifyMark, notifyId, notifySodane, dump,
		updatePanelView, updatePostformView, resetPostformView,
		get lastStats () {return lastStats}
	};
}

function createUrlStorage () {
	function loadSlot (callback) {
		try {
			chrome.storage.sync.get({openedThreads:[]}, result => {
				if (chrome.runtime.lastError) {
					console.error(`${APP_NAME}: loadSlot: ${chrome.runtime.lastError.message}`);
					callback([]);
					return;
				}

				/*
				if (devMode) {
					const buffer = result.openedThreads.map(item => {
						const expire = new Date(item.expire);
						const [server, board, number] = item.key.split('-');
						return `${server}.2chan.net/${board}/res/${number}.htm (count: ${item.count}, post: ${item.post}, expire: ${expire.toLocaleString()})`
					});
					console.log(buffer.join('\n'));
				}
				*/

				const now = Date.now();
				result.openedThreads = result.openedThreads.filter(item => item.expire > now);
				callback(result.openedThreads);
			});
		}
		catch (err) {
			console.error(`${APP_NAME}: loadSlot: ${err.stack}`);
			throw new Error(chrome.i18n.getMessage('cannot_connect_to_backend'));
		}
	}

	function saveSlot (slot) {
		try {
			storage.setSynced({
				openedThreads: slot
			});

		}
		catch (err) {
			console.error(`${APP_NAME}: saveSlot: ${err.stack}`);
			throw new Error(chrome.i18n.getMessage('cannot_connect_to_backend'));
		}

		/*
		 * cookie cathists, catviews structure is
		 *
		 * histories      := historyEntries "/" hiddenEntries
		 * historyEntries := ( entry ( "-" entry)* )?
		 * hiddenEntries  := ( entry ( "-" entry)* )?
		 * entry          := [0-9]+
		 */

		const catviews = slot.reduce((result, item) => {
			const [server, board, number] = item.key.split('-');
			if (server == siteInfo.server && board == siteInfo.board) {
				result.push(number);
			}
			return result;
		}, []).join('-');
		setBoardCookie('catviews', `${catviews}/`, 100);
	}

	function indexOf (slot, key) {
		let result = -1;
		slot.some((item, i) => {
			if (item.key == key) {
				result = i;
				return true;
			}
		});
		return result;
	}

	function getKey () {
		return siteInfo.resno ?
			`${siteInfo.server}-${siteInfo.board}-${siteInfo.resno}` :
			null;
	}

	function memo (callback) {
		const key = getKey();
		if (!key) return;

		loadSlot(slot => {
			const index = indexOf(slot, key);
			let item;

			if (index >= 0) {
				item = slot[index];
				item.count++;
			}
			else {
				item = {expire: null, key: key, count: 1, post: 0};
				slot.push(item);
			}

			if (typeof callback == 'function') {
				try {
					callback(item);
				}
				catch (err) {
				}
				/*
				if (devMode) {
					const buffer = [item].map(item => {
						const expire = item.expire ?
							(new Date(item.expire)).toLocaleString() :
							'(N/A)';
						const [server, board, number] = item.key.split('-');
						return `${server}.2chan.net/${board}/res/${number}.htm (count: ${item.count}, post: ${item.post}, expire: ${expire})`
					});
					console.log(`urlStorage: ${buffer.join('\n')}`);
				}
				*/
			}

			saveSlot(slot);
		});
	}

	function getAll () { /*returns promise*/
		return new Promise(resolve => {
			loadSlot(slot => {
				const result = {};
				slot.forEach(item => {
					const key = item.key.split('-');
					if (siteInfo.server == key[0] && siteInfo.board == key[1]) {
						result[key[2]] = item;
					}
				});

				/*
				 * result is key(threadNumber) - value (object) object like: {
				 *   '0000000001': { ... },
				 *   '0000000002': { ... },
				 *        :
				 *        :
				 * }
				 */

				resolve(result);
			});
		});
	}

	return {memo, getAll};
}

function createCatalogPopup (container) {
	const popups = [];
	let timer;

	function _log (s) {
		//log(s);
	}

	function mover (e) {
		if (!storage.config.catalog_popup_enabled.value) return;
		if (transport.isRunning('reload-catalog-main')) return;
		if (transport.isRunning('reload-catalog-sub')) return;
		if (!cursorPos.moved) return;
		_log('mover: ' + (e.target.outerHTML || '<#document>').match(/<[^>]*>/)[0]);

		let target;
		if (e.target.nodeName == 'IMG' || e.target.classList.contains('text')) {
			target = e.target;
			while (target && target.nodeName != 'A') {
				target = target.parentNode;
			}
		}
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		if (!target) {
			_log('mover: target not found');
			closeAll();
			return;
		}

		closeAll(target);
		timer = setTimeout(target => {
			timer = null;
			for (let p = document.elementFromPoint(cursorPos.x, cursorPos.y); p; p = p.parentNode) {
				if (p == target) {
					_log('mover phase 2: target found');
					prepare(target);
					break;
				}
			}
		}, CATALOG_POPUP_DELAY, target);
	}

	function indexOf (target) {
		let result = -1;
		popups.some((item, i) => {
			if (item.target == target) {
				result = i;
				return true;
			}
		});
		return result;
	}

	function getRect (elm) {
		const rect = elm.getBoundingClientRect();
		const sl = docScrollLeft();
		const st = docScrollTop();
		return {
			left:   sl + rect.left,
			top:    st + rect.top,
			right:  sl + rect.right,
			bottom: st + rect.bottom,
			width:  rect.width,
			height: rect.height
		};
	}

	function setGeometory (elm, rect) {
		elm.style.left = rect.left + 'px';
		elm.style.top = rect.top + 'px';
		elm.style.width = rect.width + 'px';
		elm.style.height = rect.height + 'px';
	}

	function clip (rect) {
		const sl = viewportRect.left + docScrollLeft();
		const st = viewportRect.top + docScrollTop();
		const sr = sl + viewportRect.width;
		const sb = st + viewportRect.height;
		const right = rect.left + rect.width;
		const bottom = rect.top + rect.height;
		if ('left' in rect && rect.left < sl) rect.left = sl;
		if ('left' in rect && right > sr) rect.left = sr - rect.width;
		if ('top' in rect && rect.top < st) rect.top = st;
		if ('top' in rect && bottom > sb) rect.top = sb - rect.height;
	}

	function prepare (target) {
		let index = indexOf(target);
		_log('prepare: index: ' + index +
			', target: ' + ($qs('.text', target) || {textContent:''}).textContent);
		if (index >= 0) {
			_log('prepare: popup for the target already exists. exit.');
			return;
		}

		let thumbnail, text, shrinkedRect;

		const targetThumbnail = $qs('img', target);
		if (targetThumbnail && targetThumbnail.naturalWidth && targetThumbnail.naturalHeight) {
			thumbnail = document.body.appendChild(document.createElement('img'));
			thumbnail.src = targetThumbnail.src.replace('/cat/', '/thumb/');
			thumbnail.className = 'catalog-popup hide';
			thumbnail.setAttribute('data-url', target.href);
			thumbnail.addEventListener('click', (e) => {
				backend.send('open', {
					url: e.target.getAttribute('data-url'),
					selfUrl: location.href
				});
			}, false);
			shrinkedRect = getRect(targetThumbnail);
		}

		const targetText = $qs('.text', target);
		const targetCount = $qs('.info span:first-child', target);
		if (targetText || targetCount) {
			text = document.body.appendChild(document.createElement('div'));
			text.className = 'catalog-popup hide';
			if (targetText) {
				text.appendChild(document.createTextNode(targetText.getAttribute('data-text')));
			}
			if (targetCount) {
				text.appendChild(document.createElement('span')).textContent = targetCount.textContent;
			}
		}

		const item = {
			state: 'initialize',
			target: target,
			thumbnail: thumbnail,
			shrinkedRect: shrinkedRect,
			text: text
		};
		popups.push(item);
		index = popups.length - 1;

		if (thumbnail && (!thumbnail.naturalWidth || !thumbnail.naturalHeight)) {
			let handleLoad = (e) => {
				e.target.removeEventListener('load', handleLoad, false);
				e.target.removeEventListener('error', handleFail, false);
				handleLoad = handleFail = null;
				open(target);
			};
			let handleFail = (e) => {
				e.target.removeEventListener('load', handleLoad, false);
				e.target.removeEventListener('error', handleFail, false);
				handleLoad = handleFail = null;
				open(target);
			};
			thumbnail.addEventListener('load', handleLoad, false);
			thumbnail.addEventListener('error', handleFail, false);
		}
		else {
			open(index);
		}
		_log('exit prepare');
	}

	function open (target) {
		const index = typeof target == 'number' ? target : indexOf(target);
		if (index < 0 || target >= popups.length) {
			_log(`open: index ${index} is invalid. exit.`);
			return;
		}

		const item = popups[index];
		_log(`open: ${item.text.textContent}`);
		if (item.thumbnail) {
			if (!item.zoomedRect) {
				item.zoomedRect = {
					width: item.shrinkedRect.width * CATALOG_POPUP_THUMBNAIL_ZOOM_FACTOR,
					height: item.shrinkedRect.height * CATALOG_POPUP_THUMBNAIL_ZOOM_FACTOR
				};
				item.zoomedRect.left = Math.floor(
					item.shrinkedRect.left +
					(item.shrinkedRect.width / 2) -
					(item.zoomedRect.width / 2));
				item.zoomedRect.top = item.shrinkedRect.top +
					item.shrinkedRect.height -
					item.zoomedRect.height;
				clip(item.zoomedRect);
			}
			setGeometory(item.thumbnail, item.shrinkedRect);
			item.thumbnail.classList.remove('hide');
			setTimeout(() => {
				item.thumbnail.classList.add('run');
				setGeometory(item.thumbnail, item.zoomedRect);
			}, 0);
		}
		if (item.text) {
			let rect = getRect(item.target);
			rect = {
				left: Math.floor(rect.left + (rect.width / 2) - (CATALOG_POPUP_TEXT_WIDTH / 2)),
				top: (item.shrinkedRect ? item.shrinkedRect.bottom : rect.bottom) + 8,
				width: CATALOG_POPUP_TEXT_WIDTH
			};
			clip(rect);
			item.text.style.left = rect.left + 'px';
			item.text.style.top = rect.top + 'px';
			item.text.style.width = rect.width + 'px';
			item.text.classList.remove('hide');
			setTimeout(() => {
				item.text.classList.add('run');
			}, 0);
		}
		item.state = 'running';
		_log('exit open');
	}

	function close (target) {
		const index = typeof target == 'number' ? target : indexOf(target);
		if (index < 0 || index >= popups.length) {
			_log(`close: index ${index} is invalid. exit.`);
			return;
		}

		let item = popups[index];
		if (item.state == 'closing') return;

		const handleTransitionend = e => {
			if (e && e.target) {
				const t = e.target;
				t.parentNode && t.parentNode.removeChild(t);
			}
			if (item && --item.closingCount <= 0 && item.state == 'closing') {
				for (let i = 0; i < popups.length; i++) {
					if (popups[i] == item) {
						item = null;
						popups.splice(i, 1);
						break;
					}
				}
			}
		};
		_log(`close: ${item.text.textContent}`);

		let count = 0;
		if (item.thumbnail) {
			transitionend(item.thumbnail, handleTransitionend);
			setGeometory(item.thumbnail, item.shrinkedRect);
			item.thumbnail.classList.remove('run');
			count++;
		}
		if (item.text) {
			transitionend(item.text, handleTransitionend);
			item.text.classList.remove('run');
			count++;
		}
		if (count <= 0) {
			popups.splice(index, 1);
		}
		else {
			item.state = 'closing';
			item.closingCount = count;
		}
		_log('exit close');
	}

	function closeAll (except) {
		_log(`closeAll: closing ${popups.length} popup(s)`);
		const elms = Array.from($qsa('body > .catalog-popup'));
		for (let i = 0; i < popups.length; i++) {
			['thumbnail', 'text'].forEach(p => {
				const index = elms.indexOf(popups[i][p]);
				index >= 0 && elms.splice(index, 1);
			});
			if (popups[i].target == except) continue;
			close(i);
		}
		elms.forEach(elm => {
			elm.parentNode && elm.parentNode.removeChild(elm);
		});
	}

	function deleteAll () {
		$qsa('body > .catalog-popup').forEach(node => {
			node.parentNode && node.parentNode.removeChild(node);
		});
		popups.length = 0;
		cursorPos.moved = false;
	}

	function init () {
		container = $(container);
		if (!container) return;

		container.addEventListener('mouseover', mover);
	}

	init();
	return {closeAll, deleteAll};
}

function createQuotePopup () {
	const POOL_ID = 'quote-popup-pool';
	const ORIGIN_CACHE_ATTR = 'data-quote-origin';
	const ORIGIN_ID_ATTR = 'data-quote-origin-id';

	let timer;
	let lastQuoteElement;

	function init () {
		if (pageModes[0].mode != 'reply') return;

		document.body.addEventListener('mousemove', mmove, false);
		clickDispatcher.add('#jumpto-quote-origin', (e, t) => {
			jumpto($(t.getAttribute(ORIGIN_ID_ATTR)));
		})
	}

	function mmove (e) {
		!timer && (timer = setTimeout(() => {
			timer = null;
			popup();
		}, QUOTE_POPUP_DELAY_MSEC));
	}

	function getParent (elm, spec) {
		spec = spec.split('.');

		const nodeName = spec[0].toLowerCase();
		const className = spec.length >= 2 ? spec[1] : '';
		const key = (nodeName != '' ? 2 : 0) | (className != '' ? 1 : 0);

		for (; elm; elm = elm.parentNode) {
			if (elm.nodeType != 1) continue;

			switch (key) {
			case 1:	// .className
				if (elm.classList.contains(className)) {
					return elm;
				}
				break;
			case 2:	// nodeName
				if (elm.nodeName.toLowerCase() == nodeName) {
					return elm;
				}
				break;
			case 3:	// nodeName.className
				if (elm.nodeName.toLowerCase() == nodeName
				&& elm.classList.contains(className)) {
					return elm;
				}
				break;
			}
		}

		return null;
	}

	function getQuoteOriginCache (quote) {
		quote = $(quote);
		if (!quote) {
			return null;
		}

		const attr = quote.getAttribute(ORIGIN_CACHE_ATTR);
		let re = /^(_\d+)\|(\d+)$/.exec(attr);
		if (!re) {
			return null;
		}

		return {
			index: re[2] - 0,
			element: $(re[1])
		};
	}

	function setQuoteOriginCache (quote, id, index) {
		quote = $(quote);
		if (!quote) {
			return;
		}

		quote.setAttribute(ORIGIN_CACHE_ATTR, `${id}|${index}`);
	}

	function getQuoteOrigin (quote, sentinelComment, sentinelWrap, singleLine) {
		if (/^[\s\u3000]*$/.test(quote.textContent)) {
			return null;
		}

		// immediately return if cache exists
		const cache = getQuoteOriginCache(quote);
		if (cache) {
			return cache;
		}

		const sentinelNo = getPostNumber(sentinelWrap);

		// lookup quote type...

		// post number (>No.xxxxxxxx)
		{
			let re = /^>+\s*(?:no\.)?(\d+)\s*(?:\n|$)/i.exec(quote.textContent);
			if (re) {
				const quotedNo = re[1] - 0;
				if (quotedNo >= sentinelNo) {
					return null;
				}

				let origin = $qs([
					`article .topic-wrap[data-number="${quotedNo}"]`,
					`article .reply-wrap > [data-number="${quotedNo}"]`
				].join(','));
				if (!origin) {
					return null;
				}
				if (origin == sentinelWrap) {
					return null;
				}

				let index = $qs('.no', origin);
				if (index) {
					index = index.textContent - 0;
				}
				else {
					index = 0;
				}

				if (!origin.classList.contains('topic-wrap')) {
					origin = origin.parentNode;
				}

				return {index, element: origin};
			}
		}

		// attached file name (>xxxxxxxxxxx.xxx)
		{
			let re = /^>+\s*(\d+\.\w+)/i.exec(quote.textContent);
			if (re) {
				let origin = $qs(`article a[href$="${re[1]}"]`);
				if (!origin) {
					return null;
				}
				if (origin == sentinelWrap) {
					return null;
				}

				let index;
				if (origin.parentNode.classList.contains('reply-image')) {
					origin = getWrapElement(origin);
					index = $qs('.no', origin).textContent - 0;
				}
				else {
					origin = $qs('article .topic-wrap');
					index = 0;
				}

				return {index, element: origin};
			}
		}

		// quote content
		let quoteTextForSearch;
		{
			const span = document.createElement('span');
			const quoteText = quote.textContent.replace(/[\s\u3000]*$/, '');

			if (singleLine) {
				quoteTextForSearch = quoteText;
			}
			else {
				sentinelComment.innerHTML.split(/<br[^>]*>/i).some(t => {
					span.innerHTML = t;
					const fragment = span.textContent
						.replace(/^\s+/, '')
						.replace(/[\s\u3000]+$/, '');
					let result = false;

					if (/^(?:>|&gt;)/.test(fragment)) {
						if (!quoteTextForSearch) {
							quoteTextForSearch = [fragment];
						}
						else {
							quoteTextForSearch.push(fragment);
						}
						if (fragment == quoteText) {
							quoteTextForSearch = quoteTextForSearch.join('\n');
							result = true;
						}
					}
					else {
						quoteTextForSearch = undefined;
					}
					return result;
				});
			}

			quoteTextForSearch = quoteTextForSearch
				.replace(/^(?:>|&gt;)/, '')
				.replace(/\n(?:>|&gt;)/g, '\n');
		}

		const nodes = $qsa([
			'article .topic-wrap .comment',
			'article .reply-wrap .comment'
		].join(','));
		for (let i = 0, goal = nodes.length; i < goal ; i++) {
			const origin = getWrapElement(nodes[i]);
			const originNo = getPostNumber(origin);

			if (originNo >= sentinelNo) {
				break;
			}
			if (nodes[i].textContent.indexOf(quoteTextForSearch) < 0) {
				continue;
			}

			return {
				index: i,
				element: origin
			};
		}

		return null;
	}

	function indexOfNodes (nodes, target) {
		return Array.prototype.indexOf.call(nodes, target);
	}

	function removePopup (sentinelComment) {
		const pool = $(POOL_ID);
		while (pool && pool.childNodes.length > 0) {
			const ch = pool.lastChild;

			if (indexOfNodes($qsa('.comment', ch), sentinelComment) >= 0) {
				break;
			}

			ch.parentNode.removeChild(ch);
		}
	}

	function createPopup (quoteOrigin, poolId) {
		const no = quoteOrigin.element.getAttribute('data-number') ||
			$qs('[data-number]', quoteOrigin.element).getAttribute('data-number');
		quoteOrigin.element.id = `_${no}`;

		// create new popup
		const div = ($(poolId) || $(POOL_ID)).appendChild(document.createElement('div'));
		div.className = 'quote-popup';
		div.appendChild(quoteOrigin.element.cloneNode(true));

		// some tweaks for contents
		{
			const noElm = $qs('.no', div);
			if (noElm) {
				const a = document.createElement('a');
				noElm.parentNode.replaceChild(a, noElm);
				a.className = 'jumpto-quote-anchor';
				a.href = '#jumpto-quote-origin';
				a.textContent = noElm.textContent;
				a.setAttribute(ORIGIN_ID_ATTR, quoteOrigin.element.id);
			}
		}

		$qsa('input[type="checkbox"], iframe, video, audio', div).forEach(node => {
			node.parentNode.removeChild(node);
		});
		$qsa('img.hide', div).forEach(node => {
			node.classList.remove('hide');
		});

		// positioning
		div.style.visibility = 'hidden';
		div.style.left = div.style.top = '0';
		const w = div.offsetWidth;
		const h = div.offsetHeight;
		const sl = docScrollLeft();
		const st = docScrollTop();
		const cw = viewportRect.width;
		const ch = viewportRect.height;
		const l = Math.max(0, Math.min(cursorPos.pagex + QUOTE_POPUP_POS_OFFSET, sl + cw - w));
		const t = Math.max(0, Math.min(cursorPos.pagey + QUOTE_POPUP_POS_OFFSET, st + ch - h));
		div.style.left = l + 'px';
		div.style.top = t + 'px';
		div.style.visibility = '';

		return div;
	}

	function popup () {
		const element = document.elementFromPoint(cursorPos.x, cursorPos.y);
		const q = getParent(element, 'q');
		const comment = getParent(element, '.comment');
		const wrap = comment ? comment.parentNode : null;

		if (q && comment && wrap) {
			/*
			if (q == lastQuoteElement) {
				return;
			}

			lastQuoteElement = q;
			 */

			for (let i = 0; i < 2; i++) {
				const quoteOrigin = getQuoteOrigin(q, comment, wrap, i == 1);
				if (!quoteOrigin) {
					continue;
				}

				removePopup(getParent(wrap, '.quote-popup') ? comment : null);
				createPopup(quoteOrigin);
				setQuoteOriginCache(q, quoteOrigin.element.id, quoteOrigin.index);

				return;
			}
		}

		if (element) {
			const quotePopupContainer = getParent(element, '.quote-popup');
			if (quotePopupContainer) {
				removePopup($qs('.comment', quotePopupContainer));
				return;
			}
		}

		removePopup();
	}

	function jumpto (target) {
		target = $(target);
		if (!target) return;
		if (!target.classList.contains('topic-wrap')
		&& !target.classList.contains('reply-wrap')) return;

		target.classList.add('highlight');
		const st = docScrollTop();
		const y = Math.max(0, target.getBoundingClientRect().top + st - QUOTE_POPUP_HIGHLIGHT_TOP_MARGIN);
		y < st && window.scrollTo(0, y);
		removePopup();

		setTimeout(() => {
			target.classList.remove('highlight');
		}, QUOTE_POPUP_HIGHLIGHT_MSEC);
	}

	init();
	return {jumpto, createPopup};
}

function createSelectionMenu () {
	let enabled = true;
	let text;

	function init () {
		window.addEventListener('mouseup', e => {
			setTimeout(mup, 0, e);
		});

		clickDispatcher.add('.selmenu', (e, t) => {
			try {
				dispatch(t.href.match(/#ss-(.+)/)[1], text);
			}
			finally {
				window.getSelection().collapseToStart();
				text = undefined;
			}
		});
	}

	function mup (e) {
		if (!enabled) return;

		let element = document.elementFromPoint(cursorPos.x, cursorPos.y);
		while (element) {
			if (element.contentEditable == 'true') return;
			element = element.parentNode;
		}

		const menu = $('selection-menu');
		if (!menu) return;

		let s = '';

		const sel = window.getSelection();
		if (sel.rangeCount) {
			s = rangeToString(sel.getRangeAt(0))
				.replace(/(?:\r\n|\r|\n)/g, '\n')
				.replace(/\n{2,}/g, '\n')
				.replace(/\n+$/, '') || '';
		}

		if (s != '') {
			text = s;
			show(menu);
		}
		else {
			hide(menu);
		}
	}

	function show (menu) {
		menu.classList.remove('hide');
		menu.style.visibility = 'hidden';
		menu.style.left = menu.style.top = '0';

		const w = menu.offsetWidth;
		const h = menu.offsetHeight;
		const sl = docScrollLeft();
		const st = docScrollTop();
		const cw = viewportRect.width;
		const ch = viewportRect.height;
		const l = Math.max(0, Math.min(cursorPos.pagex, sl + cw - w));
		const t = Math.max(0, Math.min(cursorPos.pagey, st + ch - h));
		menu.style.left = `${l}px`;
		menu.style.top = `${t}px`;
		menu.style.visibility = '';
	}

	function hide (menu) {
		menu.classList.add('hide');
	}

	function dispatch (key, text) {
		switch (key) {
		case 'quote':
		case 'pull':
			commands.activatePostForm(`quote popup (${key})`);
			quote($('com'), text, /^quote\b/.test(key));
			break;
		case 'join':
			{
				const com = $('com');
				const sel = window.getSelection();
				if (com && sel && sel.rangeCount) {
					const r1 = sel.getRangeAt(0);

					let start = r1.startContainer;
					for (; start; start = start.parentNode) {
						if (start.nodeType == 1) break;
					}

					let end = r1.endContainer;
					for (; end; end = end.parentNode) {
						if (end.nodeType == 1) break;
					}

					if (start && end) {
						const r2 = document.createRange();
						r2.setStartBefore(start);
						r2.setEndAfter(end);

						const result = Array.from($qsa('.comment', r2.cloneContents()))
							.map(node => Array.from(node.childNodes)
								.filter(cnode => cnode.nodeType == 3)
								.map(cnode => cnode.nodeValue.replace(/\n+$/, ''))
								.join(''))
							.join('');

						commands.activatePostForm(`quote popup (${key})`).then(() => {
							quote(com, result, false);
						});
					}
					else {
						setBottomStatus('選択範囲が変です。');
					}
				}
			}
			break;

		case 'copy':
		case 'copy-with-quote':
			{
				const quoted = key == 'copy' ? text : getQuoted(text);

				if ('clipboard' in navigator) {
					navigator.clipboard.writeText(quoted);
				}
				else if (IS_GECKO) {
					setClipboardGecko(quoted);
				}
			}
			break;

		case 'google':
			open('https://www.google.com/search?hl=ja&q=$TEXT$');
			break;
		case 'google-image':
			open('https://www.google.com/search?tbm=isch&hl=ja&q=$TEXT$');
			break;
		case 'amazon':
			open('https://www.amazon.co.jp/exec/obidos/external-search?mode=blended&field-keywords=$TEXT$');
			break;
		case 'wikipedia':
			open('https://ja.wikipedia.org/wiki/%E7%89%B9%E5%88%A5:Search?search=$TEXT$&go=%E8%A1%A8%E7%A4%BA');
			break;
		case 'youtube':
			open('https://www.youtube.com/results?search_query=$TEXT$&search=Search');
			break;
		case 'twitter':
			open('https://twitter.com/search?src=typd&q=$TEXT$');
			break;
		}
	}

	function open (url) {
		url = url.replace('$TEXT$', encodeURIComponent(text).replace(/%20/g, '+'));
		backend.send('open',
			{
				url: url,
				selfUrl: location.href
			});
	}

	function getQuoted (s) {
		return s.split('\n')
			.map(line => `>${line}`)
			.join('\n');
	}

	function quote (target, text, addPrefix) {
		target = $(target);
		if (!target) return;

		const s = (addPrefix ? getQuoted(text) : text).replace(/^\s+|\s+$/g, '');
		if (s == '') return;

		const lead = /^\s*$/.test(target.textContent) ? '' : '\n';

		setCaretToContentLast(target);
		document.execCommand('insertText', false, `${lead}${s}\n`);
	}

	function setCaretToContentLast (el) {
		if ('value' in el) {
			el.setSelectionRange(el.value.length, el.value.length);
		}
		else {
			regalizeEditable(el);
			document.execCommand('selectAll', false, null);
			document.getSelection().getRangeAt(0).collapse(false);
		}
	}

	function setClipboardGecko (text) {
		const textarea = document.body.appendChild(document.createElement('textarea'));
		try {
			Object.assign(textarea.style, {
				position: 'fixed',
				width: '300px',
				height: '300px',
				left: '-400px',
				top: '0px'
			});
			textarea.value = text;
			textarea.focus();
			textarea.select();
			document.execCommand('copy');
		}
		finally {
			textarea.parentNode.removeChild(textarea);
		}
	}

	init();
	return {
		dispatch,
		get enabled () {return enabled},
		set enabled (v) {enabled = !!enabled}
	};
}

function createFavicon () {
	const FAVICON_ID = 'dyn-favicon';
	let isLoading = false;

	function createLinkNode () {
		const link = document.head.appendChild(document.createElement('link'));
		link.setAttribute('rel', 'icon');
		link.setAttribute('id', FAVICON_ID);
		link.setAttribute('type', 'image/png');
		return link;
	}

	function overwriteFavicon (image, favicon) {
		image = $(image);
		if (!image) return;
		if (image.naturalWidth == 0 || image.naturalHeight == 0) return;

		favicon = $(favicon);
		if (!favicon) return;

		const w = 16;
		const h = 16;
		const factor = 3;
		const canvas = document.createElement('canvas');
		canvas.width = w * factor;
		canvas.height = h * factor;
		const c = canvas.getContext('2d');
		c.fillStyle = '#000000';
		c.fillRect(0, 0, canvas.width, canvas.height);
		const clipSize = Math.min(image.width, image.height);
		c.drawImage(image,
			image.width / 2 - clipSize / 2,
			image.height / 2 - clipSize / 2,
			clipSize, clipSize, 0, 0, canvas.width, canvas.height);

		const ps = c.getImageData(0, 0, w * factor, h * factor);
		let pd;
		if (window.unsafeWindow && window.unsafeWindow.ImageData) {
			pd = new window.unsafeWindow.ImageData(w, h);
		}
		else if (c.createImageData) {
			pd = c.createImageData(w, h);
		}
		else if (window.ImageData) {
			pd = new window.ImageData(w, h);
		}

		if (pd) {
			const factorPower = Math.pow(factor, 2);
			for (let i = 0; i < h; i++) {
				for (let j = 0; j < w; j++) {
					const avg = [0, 0, 0, 0];

					for (let k = 0; k < factor; k++) {
						for (let l = 0; l < factor; l++) {
							avg[0] += ps.data[((i * factor + k) * w * factor + (j * factor + l)) * 4 + 0];
							avg[1] += ps.data[((i * factor + k) * w * factor + (j * factor + l)) * 4 + 1];
							avg[2] += ps.data[((i * factor + k) * w * factor + (j * factor + l)) * 4 + 2];
							avg[3] += ps.data[((i * factor + k) * w * factor + (j * factor + l)) * 4 + 3];
						}
					}

					for (let k = 0; k < 4; k++) {
						avg[k] = Math.floor(avg[k] / factorPower);
						avg[k] += (255 - avg[k]) / 8;
						pd.data[(i * w + j) * 4 + k] = Math.min(255, avg[k]);
					}
				}
			}

			canvas.width = w;
			canvas.height = h;
			canvas.getContext('2d').putImageData(pd, 0, 0);
			favicon.href = canvas.toDataURL('image/png');
		}
	}

	function update () {
		if (isLoading) return;

		const link = $(FAVICON_ID);
		if (link) return;

		switch (pageModes[0].mode) {
		case 'summary':
		case 'catalog':
			isLoading = true;
			resources.get(
				`/images/board/${siteInfo.server}-${siteInfo.board}.png`,
				{responseType:'dataURL'}
			).then(data => {
				if (data) {
					createLinkNode().href = data.replace(
						/^data:[^,]+/, 'data:image/png;base64');
				}
				isLoading = false;
			});
			break;

		case 'reply':
			{
				let thumb = $qs('article:nth-of-type(1) img');
				if (!thumb) break;

				let re = /^[^:]+:\/\/([^\/]+)/.exec(thumb.src);
				if (!re) break;

				// thumbnail exists in the same domain as the document?
				if (re[1] == location.host) {
					// yes: use thumbnail directly
					if (thumb.naturalWidth && thumb.naturalHeight) {
						overwriteFavicon(thumb, createLinkNode());
					}
					else {
						isLoading = true;
						thumb.onload = () => {
							overwriteFavicon(thumb, createLinkNode());
							isLoading = false;
							thumb = thumb.onload = null;
						};
					}
				}

				// no: transform thumbnail url
				else {
					isLoading = true;
					getImageFrom(thumb.src).then(img => {
						if (img) {
							overwriteFavicon(img, createLinkNode());
						}
						isLoading = false;
					});
				}
			}
			break;
		}
	}

	function init () {
	}

	init();
	return {update};
}

function createHistoryStateWrapper () {
	let popstateHandler;
	return {
		setHandler: handler => {
			popstateHandler = handler;
			window.addEventListener('popstate', popstateHandler);
		},
		pushState: url => {
			window.history.pushState(null, '', url);
			popstateHandler();
		},
		updateHash: hash => {
			if (hash != '') {
				hash = '#' + hash.replace(/^#/, '');
			}
			const url = `${location.protocol}//${location.host}${location.pathname}${hash}${location.search}`;
			window.history.replaceState(null, '', url);
		}
	};
}

function createTransport () {
	/*
	 * - postBase(post, delete, moderate)
	 * - reloadBase(reload)
	 * - reloadCatalogBase(reload)
	 */
	const transports = {};
	const lastUsedTime = {};

	function createXMLHttpRequest () {
		try {
			// Firefox's WebExtensions is still incomplete
			return XPCNativeWrapper(new window.wrappedJSObject.XMLHttpRequest);
		}
		catch (ex) {
			return new window.XMLHttpRequest;
		}
	}

	function create (tag) {
		const result = createXMLHttpRequest();

		if (tag) {
			transports[tag] = result;
		}

		return result;
	}

	function release (tag) {
		if (tag in transports) {
			delete transports[tag];
			lastUsedTime[tag] = Date.now();
		}
	}

	function abort (tag) {
		if (tag in transports) {
			try {
				transports[tag].abort();
			}
			catch (e) {
			}

			release(tag);
		}
	}

	function isRapidAccess (tag) {
		let result = false;

		if (tag in lastUsedTime
		&& Date.now() - lastUsedTime[tag] <= NETWORK_ACCESS_MIN_INTERVAL) {
			setBottomStatus('ちょっと待ってね。');
			result = true;
		}

		return result;
	}

	function isRunning (tag) {
		if (tag) {
			return !!transports[tag];
		}
		else {
			return Object.keys(transports).length > 0;
		}
	}

	function getTransport (tag) {
		if (tag in transports) {
			return transports[tag];
		}

		return undefined;
	}

	return {
		create, release, abort, isRapidAccess, isRunning,
		get: getTransport
	};
}

function createScrollManager (frequencyMsecs) {
	const listeners = [];
	let lastScrollTop = 0;
	let timer;

	function handleScroll () {
		lastScrollTop = docScrollTop();

		if (timer) return;

		timer = setTimeout(() => {
			timer = null;
			listeners.forEach(listener => {
				try {
					listener();
				}
				catch (e) {
				}
			});
		}, frequencyMsecs);
	}

	function addEventListener (listener) {
		const index = listeners.indexOf(listener);
		if (index < 0) {
			listeners.push(listener);
		}
	}

	function removeEventListener (listener) {
		const index = listeners.indexOf(listener);
		if (index >= 0) {
			listener.splice(index, 1);
		}
	}

	window.addEventListener('scroll', handleScroll);

	return {
		addEventListener, removeEventListener,
		get lastScrollTop () {return lastScrollTop}
	};
}

function createActiveTracker () {
	const DEFAULT_MEDIAN = 1000 * 6;
	const MEDIAN_MAX = 1000 * 60;
	const TIMER1_FREQ_MIN = Math.max(1000 * 10, NETWORK_ACCESS_MIN_INTERVAL);
	const TIMER1_FREQ_MAX = 1000 * 60 * 5;
	const TIMER2_FREQ = 1000 * 3;

	let currentState;
	let timer2;
	let baseTime;
	let waitSeconds;
	let lastMedian;
	let lastReferencedReplyNumber;

	function l (s) {
		const now = new Date;
		const time = `${now.toLocaleTimeString()}.${now.getMilliseconds()}`;
		if (devMode) {
			console.log(`${time}: ${s}`);
		}
		$qsa('a[href="#autotrack"]').forEach(node => {
			node.title = `${time}: ${s}`;
		});
	}

	function getTimeSpanText (span) {
		if (isNaN(span)) {
			return '(N/A)';
		}

		const text = [];
		if (span >= 3600) {
			text.push(`${Math.floor(span / 3600)}時間`);
			span %= 3600;
		}
		if (span >= 60) {
			text.push(`${Math.floor(span / 60)}分`);
			span %= 60;
		}
		text.push(`${span}秒`);

		return text.join('');
	}

	function updateNormalLink () {
		$qsa('a[href="#autotrack"]').forEach(node => {
			$t(node, '自動追尾');
			node.title = '';
		});
		$qsa('.track-indicator').forEach(node => {
			node.style.transitionProperty = '';
			node.style.transitionDuration = '.25s';
			node.style.width = '0px';
		});
	}

	function updateTrackingLink (restSeconds, ratio) {
		restSeconds = Math.max(0, restSeconds);
		const text = getTimeSpanText(Math.floor(restSeconds));
		const width = Math.floor($('reload-anchor').offsetWidth * Math.max(0, ratio));
		$qsa('.track-indicator').forEach(node => {
			node.style.transitionProperty = 'none';
			node.style.transitionDuration = '0s';
			node.style.width = `${width}px`;
			node.title = text != '0秒' ?
				`あと ${text} くらいで更新します` :
				`まもなく更新します`;
		});
	}

	function startTimer2 () {
		if (timer2) {
			return;
		}

		l('activeTracker#startTimer2');
		timer2 = setInterval(() => {
			if (currentState != 'running') {
				return;
			}

			const elapsedSeconds = (Date.now() - baseTime) / 1000;
			const restSeconds = waitSeconds - elapsedSeconds;
			updateTrackingLink(restSeconds, restSeconds / waitSeconds);
			if ($qs('.track-indicator').offsetWidth > 0) {
				return;
			}

			setCurrentState('reloading');
			if (pageModes[0].mode == 'reply') {
				commands.reload({isAutotrack: true, scrollBehavior: 'always'}).then(() => {
					const isValidStatus = /^[23]..$/.test(reloadStatus.lastStatus);
					const isMaxresReached =
						!!$qs('.expire-maxreached:not(.hide)')
						|| siteInfo.maxReplies >= 0 && $qsa('.replies .reply-wrap').length >= siteInfo.maxReplies;

					if (isValidStatus && !isMaxresReached) {
						setCurrentState();
						start();
					}
					else {
						stopTimer2();
						setCurrentState();
						l([
							`activeTracker:`,
							`timer cleared.`,
							`reason: unusual http status (${reloadStatus.lastStatus})`
						].join(' '));
					}
				});
			}
			else if (pageModes.length >= 2 && pageModes[1].mode == 'reply') {
				setCurrentState();
				start();
			}
			else {
				stopTimer2();
				setCurrentState();
				l([
					`activeTracker:`,
					`timer cleared.`,
					`reason: not a reply mode (${pageModes[0].mode})`
				].join(' '));
			}
		}, TIMER2_FREQ);
	}

	function stopTimer2 () {
		l('activeTracker#stopTimer2');
		if (timer2) {
			clearInterval(timer2);
			timer2 = undefined;
		}
		updateNormalLink();
	}

	function computeTrackFrequency () {
		const logs = [];
		let median = 0;
		let referencedReplyNumber = 0;

		const postTimes = Array
		.from($qsa(`.replies .reply-wrap:nth-last-child(-n+${storage.config.autotrack_sampling_replies.value + 1})`))
		.map(node => {
			referencedReplyNumber = $qs('[data-number]', node).dataset.number - 0;
			return new Date($qs('.postdate', node).dataset.value - 0);
		});

		const intervals = [];
		for (let i = 0; i < postTimes.length - 1; i++) {
			intervals.push(Math.max(1, postTimes[i + 1].getTime() - postTimes[i].getTime()));
		}

		if (intervals.length == 0 && !lastMedian) {
			median = DEFAULT_MEDIAN;
			logs.push(`frequency median set to default ${median}.`);
		}
		else if (referencedReplyNumber == lastReferencedReplyNumber) {
			median = lastMedian * 1.25;
			median = Math.floor(median / 1000) * 1000;
			median = Math.min(median, MEDIAN_MAX);
			logs.push(`number of replies has not changed. use the previous median value: ${lastMedian} -> ${median}`);
		}
		else {
			intervals.sort((a, b) => a - b);
			const medianIndex = Math.floor(intervals.length / 2);
			const tempMedian = (intervals.length % 2) ?
				intervals[medianIndex] :
				(intervals[medianIndex - 1] + intervals[medianIndex]) / 2;

			if (isNaN(lastMedian)) {
				median = tempMedian;
			}
			else if (isNaN(tempMedian)) {
				median = lastMedian * 1.25;
			}
			else {
				median = (lastMedian + tempMedian) / 2;
			}

			if (isNaN(median)) {
				median = DEFAULT_MEDIAN;
			}

			median = Math.floor(median / 1000) * 1000;
			median = Math.min(median, MEDIAN_MAX);

			logs.push(
				`  postTimes: ${postTimes.map(a => a.toLocaleTimeString()).join(', ')}`,
				`  intervals: ${intervals.map(a => `${getTimeSpanText(a / 1000)}`).join(', ')}`,
				`medianIndex: ${medianIndex}`,
				` multiplier: ${storage.config.autotrack_expect_replies.value}`,
				`   sampling: ${storage.config.autotrack_sampling_replies.value}`,
				` lastMedian: ${lastMedian} - ${getTimeSpanText(lastMedian / 1000)}`,
				` tempMedian: ${tempMedian} - ${getTimeSpanText(tempMedian / 1000)}`,
				`     median: ${median} - ${getTimeSpanText(median / 1000)}`
			);
		}

		let result = median * storage.config.autotrack_expect_replies.value;
		result = Math.min(result, TIMER1_FREQ_MAX);
		result = Math.max(result, TIMER1_FREQ_MIN);
		lastMedian = median;
		lastReferencedReplyNumber = referencedReplyNumber;

		logs.push(
			`----`,
			`result wait msecs: ${result} - ${getTimeSpanText(result / 1000)}`
		);
		l(logs.join('\n'));

		return result;
	}

	function setCurrentState (state) {
		currentState = state;
	}

	function start () {
		if (currentState) return;

		setCurrentState('preparing');

		$qsa('a[href="#autotrack"]').forEach(node => {
			$t(node, `自動追尾中`);
		});

		const indicator = $qs('.track-indicator');
		indicator.style.transitionProperty = '';
		indicator.style.transitionDuration = '.25s';
		indicator.style.width = `${$('reload-anchor').offsetWidth}px`;
		transitionendp(indicator, 1000 * 0.25).then(() => {
			setCurrentState('running');
			const restMsecs = computeTrackFrequency();
			baseTime = Date.now();
			waitSeconds = restMsecs / 1000;
			startTimer2();
		})
	}

	function stop () {
		if (!currentState) return;

		currentState = undefined;
		lastMedian = lastReferencedReplyNumber = 0;
		stopTimer2();
	}

	function reset () {
		if (currentState != 'running') return;

		l('activeTracker#reset');
		setCurrentState();
		start();
	}

	return {
		start, stop, reset,
		get running () {return !!currentState}
	};
}

function createPassiveTracker () {
	const THRESHOLD_INTERVAL_MSECS = 1000 * 30;

	let expireDate;
	let timerID;

	function next () {
		const isValidStatus = /^[23]..$/.test(reloadStatus.lastStatus);
		const isMaxresReached =
			!!$qs('.expire-maxreached:not(.hide)')
			|| siteInfo.maxReplies >= 0 && $qsa('.replies .reply-wrap').length >= siteInfo.maxReplies;

		timerID = undefined;

		if (isValidStatus && !isMaxresReached) {
			update(expireDate);
		}
	}

	function timer () {
		if (pageModes[0].mode != 'reply' || activeTracker.running) {
			timerID = undefined;
			update(expireDate);
		}
		else {
			commands.reload({isAutotrack: true, scrollBehavior: 'none'}).then(next);
		}
	}

	function update (ed) {
		if (!(ed instanceof Date)) return;
		if (pageModes[pageModes.length - 1].mode != 'reply') return;

		expireDate = ed;

		if (timerID) return;

		const interval = Math.max(
			THRESHOLD_INTERVAL_MSECS,
			Math.floor((expireDate.getTime() - Date.now()) / 2));

		timerID = setTimeout(timer, interval);
	}

	return {update};
}

function createTitleIndicator () {
	const BLINK_MAX = 1000 * 60 * 2;

	let timer;
	let originalTitle;
	let blinkCount;

	function handleVisibilityChange () {
		if (!document.hidden) {
			stopBlink();
		}
	}

	function handleTimer () {
		if (blinkCount >= BLINK_MAX) {
			stopBlink();
			return;
		}

		document.title = blinkCount++ % 2 == 0 ?
			originalTitle :
			'!更新!';
	}

	function startBlink () {
		if (timer) return;
		if (!document.hidden) return;

		originalTitle = document.title;
		blinkCount = 0;
		timer = setInterval(handleTimer, 500);
		sounds.trackerWorked.play();
	}

	function stopBlink () {
		if (!timer) return;

		clearInterval(timer);
		timer = undefined;
		document.title = originalTitle;
	}

	document.addEventListener('visibilitychange', handleVisibilityChange);

	return {startBlink, stopBlink};
}

function createModerator () {
	const PROMISE_KEY = 'moderate';
	let lastModerated;

	function register (postNumber, reason, delayMsecs) {
		globalPromises[PROMISE_KEY] = globalPromises[PROMISE_KEY].then(async () => {
			const url = `${location.protocol}//${location.host}/del.php`;
			const opts = {
				method: 'POST',
				body: new URLSearchParams({
					mode: 'post',
					b: siteInfo.board,
					d: postNumber,
					reason: reason,
					responsemode: 'ajax'
				})
			};
			const result = await load(url, opts, 'text;charset=Shift_JIS');
			const text = result.error || result.content;

			if (devMode) {
				const now = new Date;
				const header = lastModerated ?
					`+${Math.floor((now.getTime() - lastModerated.getTime()) / 1000)}s` :
					now.toLocaleString();
				console.log(`${header}: moderated for ${postNumber}.`);
				lastModerated = now;
			}

			$qsa(`[data-number="${postNumber}"] .del`).forEach(node => {
				node.classList.add('posted');
				if (text) {
					node.setAttribute('title', `del済み (${text})`);
				}
			});

			await delay(delayMsecs);
		});
	}

	globalPromises[PROMISE_KEY] = Promise.resolve();

	return {register};
}

function createResourceSaver () {
	const MODULE_NAME = 'resource-saver';
	const fileSystemManager = createFileSystemManager();
	const savers = {};

	function createFileSystemManager () {
		const fileSystems = {};

		async function get (...args) {
			const module = await modules('file-system-access');

			for (const id of args) {
				if (!(id in fileSystems)) {
					fileSystems[id] = module.createFileSystemAccess(id);
				}
			}

			return args.length == 1 ? fileSystems[args[0]] : fileSystems;
		}

		return {get};
	}

	function getModule () {
		return modules(MODULE_NAME).then(module => {
			if (typeof module.getAssetURLTranslator() != 'function') {
				module.setAssetURLTranslator(url => {
					return backend.send('fetch', {url}).then(({objectURL}) => objectURL);
				});
			}
			return module;
		});
	}

	function getLocalPath (url, targetNode, template) {

		function getImageAttributes () {
			let dateAvailable = true;
			let re;

			/*
			 * image on image board of futaba server:
			 *
			 * https: *img.2chan.net/b/src/999999999.jpg
			 *         ^^^           ^     ^^^^^^^^^
			 *          1            2         3
			 */
			re = /^https?:\/\/([^.]+)\.2chan\.net(?::\d+)?\/([^\/]+)\/src\/(\d+)\.([^.]+)/.exec(url);

			/*
			 * image on up/up2 of futaba server:
			 *
			 * https: *dec.2chan.net/up2/src/fu999999.jpg
			 *         ^^^           ^^^     ^^^^^^^^
			 *          1             2          3
			 */
			if (!re) {
				re = /^https?:\/\/([^.]+)\.2chan\.net(?::\d+)?\/([^\/]+)\/src\/(\w+\d+)\.([^.]+)/.exec(url);
				if (re) {
					dateAvailable = false;
				}
			}

			/*
			 * image on siokara server:
			 *
			 * https: *www.nijibox5.com/futabafiles/tubu/src/su999999.jpg
			 *             ^^^^^^^^                 ^^^^     ^^^^^^^^
			 *                 1                      2          3
			 */
			/*
			if (!re) {
				re = /^https?:\/\/[^.]+\.(nijibox\d+)\.com(?::\d+)?\/futabafiles\/([^\/]+)\/src\/(\w+\d+)\.([^.]+)/.exec(url);
				if (re) {
					dateAvailable = false;
					re[1] = 'siokara';
				}
			}
			*/

			if (re) {
				return {
					serverKey: re[1],
					boardKey: re[2],
					serial: re[3],
					extension: re[4],
					// pick up current date for images which has
					// unknown creation timestamp:
					date: dateAvailable ? new Date(re[3] - 0) : new Date
				}
			}
		}

		function sanitize (s, isComponent = false) {
			// translate newlines to space
			s = s.replace(/[\r\n]+/g, ' ');

			// strip control characters
			s = s.replace(/[\u0000-\u001f]/g, '');

			// strip Unicode formatting characters:
			//
			//   U+200B Zero Width Space
			//   U+200C Zero Width Non-Joiner
			//   U+200D Zero Width Joiner
			//   U+200E Left-To-Right Mark
			//   U+200F Right-To-Left Mark
			//   U+202A Left-To-Right Embedding
			//   U+202B Right-To-Left Embedding
			//   U+202C Pop Directional Formatting
			//   U+202D Left-To-Right Override
			//   U+202E Right-To-Left Override
			s = s.replace(/[\u200b-\u200f\u202a-\u202e]/g, '');

			// strip soft hyphen
			s = s.replace(/\u00ad/g, '');

			// substitute reserved characters on Windows platform
			// @see https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file#naming-conventions
			const trmap = {
				'<': '＜',
				'>': '＞',
				':': '：',
				'"': '”',
				// '/': '／',
				// '\\': '＼',
				'|': '｜',
				'?': '？',
				'*': '＊'
			};
			s = s.replace(/[<>:"|?*]/g, $0 => trmap[$0]);

			// translate multiple space like characters to space, '     ' -> ' '
			s = s.replace(/\s+/g, ' ');

			// substitute reserved device names on Windows platform
			s = s.replace(/\/(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])\b/ig, $0 => `_${$0.substring(1)}`);

			if (isComponent) {
				const trmap = {
					'/': '／',
					'\\': '＼'
				};
				s = s.replace(/[\/\\]/g, $0 => trmap[$0]);
			}
			else {
				// change backslash into slash, \ -> /
				s = s.replace(/\\/g, '/');

				// fold multiple slashes, ////// -> /
				s = s.replace(/\/{2,}/g, '/');

				// fold multiple dots, ...... -> .
				s = s.replace(/\.{2,}/g, '.');

				// Windows does not allow a path ending with period.
				s = s.replace(/\.$/, '');
			}

			return s;
		}

		function getThreadAttributes () {
			const result = {
				serverKey: siteInfo.server,
				boardKey: siteInfo.board,
				serial: siteInfo.resno,
				extension: 'html',
				date: siteInfo.date,
				firstCommentText: null,
				replyCommentText: null
			};

			// retrieve thread number and first comment text
			result.firstCommentText = (p => {
				if (!p) return '';

				let firstCommentText = '';
				let defaultCommentText = '';

				$qsa('.topic-wrap', p).forEach(node => {
					result.serial = node.getAttribute('data-number') - 0;
				});

				$qsa('.topic-wrap .postdate', p).forEach(node => {
					result.date = new Date(node.getAttribute('data-value') - 0);
				});

				Array.from($qsa('.comment', p)).some(node => {
					const comment = commentToString(node);
					if (/^ｷﾀ━+\(ﾟ∀ﾟ\)━+\s*!+$/.test(comment)) {
						defaultCommentText = comment;
						return false;
					}
					else {
						firstCommentText = comment;
						return true;
					}
				});

				firstCommentText = firstCommentText.split('\n');
				// if all comments are quoted line...
				if (firstCommentText.filter(line => /^\s*>/.test(line)).length == firstCommentText.length) {
					// reduce 1 quote level
					firstCommentText = firstCommentText
						.map(line => line.replace(/^\s*>/, ''));
				}

				firstCommentText = firstCommentText.filter(line => {
					// reject quote
					if (/^\s*>/.test(line)) return false;

					// reject filename
					if (/^\s*[a-z]*\d+\.[^.]+\s*$/.test(line)) return false;

					return true;
				}).join('\n');

				if (firstCommentText == '') {
					firstCommentText = defaultCommentText;
				}
				if (firstCommentText == '') {
					firstCommentText = 'ｷﾀ━━━(ﾟ∀ﾟ)━━━!!';
				}

				// sanitize
				firstCommentText = sanitize(firstCommentText, true);

				// trim surrounding spaces
				firstCommentText = firstCommentText.replace(/^\s*|\s*$/g, '');

				// limit length
				firstCommentText = substringWithStrictUnicode(
					firstCommentText,
					storage.config.save_image_text_max_length.value,
					storage.config.save_image_text_max_length.min
				);

				return firstCommentText;
			})(targetNode && targetNode.closest('article') || $qs('article'));

			// retrieve relative reply comment text
			result.replyCommentText = (p => {
				if (!p) return null;

				let replyCommentText = null;

				$qsa('.comment', p).forEach(node => {
					replyCommentText = commentToString(node);
				});

				if (!replyCommentText) return null;

				replyCommentText = replyCommentText.split('\n').filter(line => {
					// reject quote
					if (/^\s*>/.test(line)) return false;

					// reject filename
					if (/^\s*[a-z]*\d+\.[^.]+\s*$/.test(line)) return false;

					return true;
				}).join('\n');

				// sanitize
				replyCommentText = sanitize(replyCommentText, true);

				// trim surrounding spaces
				replyCommentText = replyCommentText.replace(/^\s*|\s*$/g, '');

				// limit length
				replyCommentText = substringWithStrictUnicode(
					replyCommentText,
					storage.config.save_image_text_max_length.value,
					storage.config.save_image_text_max_length.min
				);

				return replyCommentText == '' ? null : replyCommentText;
			})(targetNode && targetNode.closest('.reply-wrap'));

			return result;
		}

		const imageAttributes = getImageAttributes();
		const threadAttributes = getThreadAttributes();

		let f = template.replace(/\$([A-Z]+)\b/g, ($0, $1) => {
			switch ($1) {
			case 'SERVER':
				return siteInfo.server;
			case 'BOARD':
				return siteInfo.board;
			case 'THREAD':
				return threadAttributes.serial;
			case 'YEAR':
				return imageAttributes ?
					imageAttributes.date.getFullYear() :
					threadAttributes.date.getFullYear();
			case 'MONTH':
				return imageAttributes ?
					('00' + (imageAttributes.date.getMonth() + 1)).substr(-2) :
					('00' + (threadAttributes.date.getMonth() + 1)).substr(-2);
			case 'DAY':
				return imageAttributes ?
					('00' + (imageAttributes.date.getDate())).substr(-2) :
					('00' + (threadAttributes.date.getDate())).substr(-2);
			case 'SERIAL':
				return imageAttributes ? imageAttributes.serial : $0;
			case 'EXT':
				return imageAttributes ? imageAttributes.extension : threadAttributes.extension;
			default:
				return $0;
			}
		});

		f = sanitize(f);
		f = f.replace(/\$TEXT\b/, threadAttributes.firstCommentText);
		f = f.replace(/\$TEXT2\b/, threadAttributes.replyCommentText || threadAttributes.firstCommentText);
		f = f.replace(/^\s*|\s*$/g, '');

		return f;
	}

	function threadSaverRunning () {
		return savers[THREAD_FILE_SYSTEM_NAME] && savers[THREAD_FILE_SYSTEM_NAME].running;
	}

	function createAssetSaverWrap (assetSaver) {
		let busy = false;

		async function getPrePermission () {
			let result;
			let prePermission;

			if (!assetSaver.fileSystemAccess.isRootDirectoryAvailable) {
				prePermission = await backend.send(
					'filesystem',
					{
						server: siteInfo.server,
						board: siteInfo.board,
						id: ASSET_FILE_SYSTEM_NAME
					});
			}

			if (prePermission
			&&  prePermission.foundSummary
			&&  !prePermission.granted) {
				result = {
					error: [
						`failed to get pre-permission`,
						`foundSummary: ${prePermission?.foundSummary}`,
						`granted: ${prePermission?.granted}`
					].join(', ')
				};
			}

			return result;
		}

		async function save (anchor, options = {}) {
			if (busy) return;
			if (anchor.dataset.imageSaved) return;

			if (location.protocol !== 'https:') {
				alert([
					`画像の保存:`,
					`お前が今開いているページは https じゃないので保存できない。`
				].join('\n'));
				return;
			}

			if (!assetSaver.fileSystemAccess.enabled) {
				alert([
					`画像の保存:`,
					`お前が今使っているブラウザにはファイルアクセス API がないので保存できない。`
				].join('\n'));
				return;
			}

			if (storage.config.storage.value !== 'fsa') {
				alert([
					`画像の保存:`,
					`${storage.config.storage.value} ストレージはサポート外になりました。`,
					`設定で local (FileSystemAccess) ストレージを選択してください。`
				].join('\n'));
				return;
			}

			const url = anchor.href;
			let localPath = _getLocalPath(url, anchor, options.template);
			if (!localPath) {
				alert([
					`画像の保存:`,
					`ファイル名が不正です。設定でファイル名のテンプレートを修正してください。`
				].join('\n'));
				return;
			}

			if (typeof options.pathOverride == 'string' && options.pathOverride != '') {
				localPath = [options.pathOverride, localPath.split('/').pop()].join('/');
			}

			busy = true;
			let originalText = anchor.textContent;
			$t(anchor, '保存中...');

			try {
				let result = await getPrePermission();

				if (!result) {
					result = await assetSaver.save(url, localPath);
				}

				if (result.error) {
					console.error(result.error);

					$qsa(`.save-image[href="${url}"]`).forEach(node => {
						$t(node, '保存失敗');
					});
				}
				else {
					originalText = '保存済み';

					if (result.created) {
						sounds.imageSaved.volume = storage.config.save_image_bell_volume.value;
						sounds.imageSaved.play();
					}

					$qsa(`.save-image[href="${url}"]`).forEach(node => {
						$t(node, '保存完了');
						node.setAttribute('title', `${result.localPath} へ保存済み`);
						node.dataset.imageSaved = '1';
					});
				}
			}
			finally {
				await delay(1000);
				$t(anchor, originalText);
				busy = false;
			}
		}

		function getDirectoryTree () {
			return storage.runtime.kokoni.treeCache ?
				Promise.resolve(storage.runtime.kokoni.treeCache) :
				updateDirectoryTree();
		}

		async function updateDirectoryTree () {
			if (busy) return;

			if (location.protocol !== 'https:') {
				alert([
					`フォルダツリーの読み込み:`,
					`お前が今開いているページは https じゃないのでフォルダツリーを読み込めない。`
				].join('\n'));
				return;
			}

			if (!assetSaver.fileSystemAccess.enabled) {
				alert([
					`フォルダツリーの読み込み:`,
					`お前が今使っているブラウザにはファイルアクセス API がないのでフォルダツリーを読み込めない。`
				].join('\n'));
				return;
			}

			busy = true;
			storage.runtime.kokoni.treeCache = null;
			try {
				let result = await getPrePermission();

				if (!result) {
					result = await assetSaver.getDirectoryTree();
				}

				if (result.error) {
					console.error(result.error);
					setBottomStatus(`フォルダツリーを更新できませんでした。`);
				}
				else {
					storage.runtime.kokoni.treeCache = result.tree;
					storage.saveRuntime();
					setBottomStatus(`フォルダツリーを更新しました。`);
				}

				return result.tree;
			}
			finally {
				busy = false;
			}
		}

		function updateLRUList (currentItem) {
			const ACCESS_TIME_TTL = 1000 * 60 * 60;
			const TIME_RANGE_TO_FLOAT = 1000 * 60 * 5;
			const FLOAT_THRESHOLD = 3;
			const LRU_ITEM_MAX = 10;

			if (!('label' in currentItem) || currentItem.label == '') {
				return;
			}

			const list = storage.runtime.kokoni.lru;
			let found = false;
			for (let i = 0; i < list.length; i++) {
				const item = list[i];

				item.accessed = item.accessed.filter(time => {
					return Date.now() - ACCESS_TIME_TTL < time;
				});

				if (item.path == currentItem.path) {
					item.accessed.push(Date.now());

					const n = item.accessed.filter(time => {
						return Date.now() - TIME_RANGE_TO_FLOAT < time;
					}).length;

					if (n >= FLOAT_THRESHOLD && i > 0) {
						list.splice(i, 1);
						list.unshift(item);
					}

					found = true;
					break;
				}
			}

			if (!found) {
				list.unshift({
					label: currentItem.path,
					path: currentItem.path,
					accessed: [Date.now()]
				});

				while (list.length > LRU_ITEM_MAX) {
					list.pop();
				}
			}

			storage.runtime.kokoni.lru = list;
			storage.saveRuntime();
		}

		function clearLRUList () {
			storage.runtime.kokoni.lru.length = 0;
			storage.saveRuntime();
			setBottomStatus(`保存履歴をクリアしました。`);
		}

		function _getLocalPath (url, anchor, template) {
			if (!template) {
				template = storage.config.save_image_name_template.value;
			}
			return getLocalPath(url, anchor, template);
		}

		return {
			save, getDirectoryTree, updateDirectoryTree,
			updateLRUList, clearLRUList,
			get busy () {return busy},
			get fileSystemAccess () {return assetSaver.fileSystemAccess}
		};
	}

	function createThreadSaverWrap (threadSaver) {
		let busy = false;

		async function start () {
			if (busy) return;
			if (threadSaver.running) return;
			if (pageModes[0].mode !== 'reply') return;
			if (reloadStatus.lastStatus == 404) return;

			if (location.protocol !== 'https:') {
				alert([
					`スレッドの保存:`,
					`お前が今開いているページは https じゃないので保存できない。`
				].join('\n'));
				return;
			}

			if (!threadSaver.fileSystemAccess.enabled) {
				alert([
					`スレッドの保存:`,
					`お前が今使っているブラウザにはファイルアクセス API がないので保存できない。`
				].join('\n'));
				return;
			}

			if (storage.config.storage.value !== 'fsa') {
				alert([
					`スレッドの保存:`,
					`${storage.config.storage.value} ストレージはサポート外になりました。`,
					`設定で local (FileSystemAccess) ストレージを選択してください。`
				].join('\n'));
				return;
			}

			const localPath = _getLocalPath(location.href);
			if (!localPath) {
				alert([
					`スレッドの保存:`,
					`ファイル名が不正です。設定でファイル名のテンプレートを修正してください。`
				].join('\n'));
				return;
			}

			busy = true;
			updateAnchor('スレッド保存中...');

			try {
				let result;
				let prePermission;

				if (!threadSaver.fileSystemAccess.isRootDirectoryAvailable) {
					prePermission = await backend.send(
						'filesystem',
						{
							server: siteInfo.server,
							board: siteInfo.board,
							id: THREAD_FILE_SYSTEM_NAME
						});
				}

				if (prePermission
				&&  prePermission.foundSummary
				&&  !prePermission.granted) {
					result = {error: 'failed to get pre-permission'};
				}

				if (!result) {
					result = await threadSaver.start(bootVars.bodyHTML, localPath)
				}

				afterSave(result);
			}
			finally {
				busy = false;
			}
		}

		async function push (stats) {
			if (busy) return;
			if (!threadSaver.running) return;
			if (pageModes[0].mode != 'reply') return;

			busy = true;
			updateAnchor('スレッド保存中...');

			try {
				let result = await threadSaver.push(stats);

				afterSave(result);
			}
			finally {
				busy = false;
			}
		}

		function stop () {
			if (pageModes[0].mode != 'reply') return;

			threadSaver.stop();
		}

		function afterSave (result) {
			if (result.error) {
				stop();
				alert([
					`スレッドの保存:`,
					`保存に失敗しました。`,
					result.error
				].join('\n'));
			}
			else {
				updateAnchor('自動保存中', node => {
					node.setAttribute(
						'title',
						[
							`保存先: ${result.localPath}`,
							`${result.lastOffset} レス目まで保存済み`
						].join('\n'));
				});
			}
		}

		function updateAnchor (text, callback) {
			$qsa('a[href="#autosave"]').forEach(node => {
				$t(node, text);
				callback && callback(node);
			});
		}

		function _getLocalPath (url, anchor) {
			return getLocalPath(
				url, anchor,
				storage.config.save_thread_name_template.value);
		}

		return {
			push, start, stop,
			get busy () {return busy},
			get running () {return threadSaver.running},
			get fileSystemAccess () {return threadSaver.fileSystemAccess}
		}
	}

	async function asset () {
		if (!savers[ASSET_FILE_SYSTEM_NAME]) {
			const fileSystemAccess = await fileSystemManager.get(ASSET_FILE_SYSTEM_NAME);
			const assetSaver = await getModule()
				.then(module => module.createAssetSaver(fileSystemAccess));
			savers[ASSET_FILE_SYSTEM_NAME] = createAssetSaverWrap(assetSaver);
		}
		return savers[ASSET_FILE_SYSTEM_NAME];
	}

	async function thread () {
		if (!savers[THREAD_FILE_SYSTEM_NAME]) {
			const fileSystemAccess = await fileSystemManager.get(THREAD_FILE_SYSTEM_NAME);
			const threadSaver = await getModule()
				.then(module => module.createThreadSaver(fileSystemAccess));
			savers[THREAD_FILE_SYSTEM_NAME] = createThreadSaverWrap(threadSaver);
		}
		return savers[THREAD_FILE_SYSTEM_NAME];
	}

	return {
		asset, thread,
		get fileSystemManager () {return fileSystemManager},
		get threadSaverRunning () {return threadSaverRunning()}
	};
}

function createFutabaXML (mode) {
	const xml = document.implementation.createDocument(null, 'futaba', null);
	const meta = xml.documentElement.appendChild(xml.createElement('meta'));
	meta.appendChild(xml.createElement('mode'))
		.appendChild(xml.createTextNode(mode));
	meta.appendChild(xml.createElement('url'))
		.appendChild(xml.createTextNode(location.href));
	meta.appendChild(xml.createElement('version'))
		.appendChild(xml.createTextNode(version));
	meta.appendChild(xml.createElement('extension_id'))
		.appendChild(xml.createTextNode(backend.extensionId));
	return xml;
}

/*
 * <<<1 page set-up functions
 */

function setupParallax (selector) {
	let marginTop = undefined;

	function init () {
		const node = $qs(selector);
		if (!node) return;
		marginTop = node.getBoundingClientRect().top;
		scrollManager.addEventListener(handleScroll);
		handleScroll();
		setTimeout(() => {
			$qsa('iframe[data-src]').forEach(iframe => {
				iframe.src = iframe.getAttribute('data-src');
				iframe.removeAttribute('data-src');
			});
		}, 1000 * 1);
	}

	function handleScroll () {
		const node = $qs(selector);
		if (!node) return;

		const rect = node.getBoundingClientRect();
		if (rect.height > viewportRect.height) {
			const stickyRange = rect.height - viewportRect.height + marginTop + 16;
			const scrollRange = document.documentElement.scrollHeight - viewportRect.height;
			const scrollTop = docScrollTop();
			const value = marginTop - Math.floor(scrollTop / scrollRange * stickyRange);
			node.style.top = value + 'px';
		}
		else {
			node.style.top = '';
		}
	}

	init();
}

function setupVideoViewer () {
	let timer;

	function init () {
		scrollManager.addEventListener(handleScroll);
		doit();
	}

	function handleScroll () {
		if (timer) return;
		timer = setTimeout(() => {
			timer = null;
			doit();
		}, 1000);
	}

	function doit () {
		const st = docScrollTop();
		const vt = st - viewportRect.height;
		const vb = st + viewportRect.height * 2;
		$qsa('.inline-video').forEach(node => {
			const rect = node.getBoundingClientRect();
			if (rect.bottom + st < vt
			||  rect.top + st > vb) {
				// invisible
				if (node.childNodes.length) {
					setBottomStatus(`解放: ${node.parentNode.getElementsByTagName('a')[0].href}`);
					empty(node);
				}
			}
			else {
				// visible
				const markup = node.getAttribute('data-markup');
				if (markup && node.childNodes.length == 0) {
					setBottomStatus(`読み込み中: ${node.parentNode.getElementsByTagName('a')[0].href}`);
					node.insertAdjacentHTML('beforeend', markup);
				}
			}
		});
	}

	init();
}

function setupMouseHoverEvent (element, nodeName, hoverCallback, leaveCallback) {
	let lastHoverElement = null;

	function findTarget (e) {
		while (e) {
			if (e.nodeName.toLowerCase() == nodeName) return e;
			e = e.parentNode;
		}
		return null;
	}

	function mover (e) {
		const fromElement = findTarget(e.relatedTarget);
		const toElement = findTarget(e.target);
		let needInvokeHoverEvent = false;
		let needInvokeLeaveEvent = false;

		if (fromElement != toElement) {
			// causes leave event?
			if (fromElement) {
				if (lastHoverElement != null) {
					needInvokeLeaveEvent = true;
				}
			}

			// causes hover event?
			if (toElement) {
				if (lastHoverElement != toElement) {
					needInvokeHoverEvent = true;
				}
			}

			// causes leave event?
			else {
				if (lastHoverElement != null) {
					needInvokeLeaveEvent = true;
				}
			}
		}

		if (needInvokeLeaveEvent) {
			leaveCallback({target: lastHoverElement});
			lastHoverElement = null;
		}
		if (needInvokeHoverEvent) {
			hoverCallback({target: toElement});
			lastHoverElement = toElement;
		}
	}

	function mout (e) {
		const toElement = findTarget(e.relatedTarget);
		if (!toElement && lastHoverElement) {
			leaveCallback({target: lastHoverElement});
			lastHoverElement = null;
		}
	};

	element = $(element);
	if (!element) return;
	nodeName = nodeName.toLowerCase();
	hoverCallback && element.addEventListener('mouseover', mover);
	leaveCallback && element.addEventListener('mouseout', mout);
}

function setupWindowResizeEvent (frequencyMsecs, handler) {
	let timer;

	function handleResize (e) {
		if (timer) {
			clearTimeout(timer);
		}

		timer = setTimeout(e => {
			timer = null;
			try {
				handler.call(window, e);
			}
			catch (ex) {
				console.error(`${APP_NAME}: exception in resize handler: ${ex.stack}`);
			}
		}, frequencyMsecs, e);
	}

	window.addEventListener('resize', handleResize);
	window.addEventListener('load', handleResize);
	handler.call(window);
}

function setupPostFormItemEvent (items) {
	const timers = {};
	const debugLines = [];
	const cache = {};

	function updateInfoCore (result, item) {
		const el = $(item.id);
		if (!el) return result;

		const cacheEntry = cache[item.id] && cache[item.id].html == el.innerHTML ?
			cache[item.id] : null;
		const contents = cacheEntry ?
			cacheEntry.contents :
			getContentsFromEditable(el).value;

		const lines = contents.replace(/[\r\n\s]+$/, '').split(/\r?\n/);
		const bytes = lines.join('\r\n').replace(/[^\u0001-\u007f\uff61-\uff9f]/g, '__').length;
		const linesOvered = item.lines ? lines.length > item.lines : false;
		const bytesOvered = item.bytes ? bytes > item.bytes : false;

		const span = $('comment-info-details').appendChild(document.createElement('span'));
		if (linesOvered || bytesOvered) {
			span.classList.add('warn');
			result = true;
		}
		$t(span, [
			item.head  ? `${item.head}:` : '',
			item.lines ? `${lines.length}/${item.lines}行` : '',
			item.lines ? ' (' : '',
			item.bytes ? `${bytes}/${item.bytes}` : '',
			item.lines ? ')' : ''
		].join(''));

		cache[item.id] = {
			html: el.innerHTML,
			contents: contents
		};

		return result;
	}

	function adjustTextAreaHeight (e) {
		// do nothing during composing
		if (e.type == 'input' && e.isComposing) {
			return;
		}

		const com = e.target;
		if (com.innerHTML != '' && /^\n*$/.test(com.innerText)) {
			empty(com);
		}

		const contents = getContentsFromEditable(com);

		debugLines.push(contents.debugInfo);
		while (debugLines.length > 10) {
			debugLines.shift();
		}

		if (devMode && $qs('[data-href="#toggle-comment-log"]').checked) {
			debugLines.forEach(line => {
				console.log(line);
			});
			debugLines.length = 0;
		}

		cache[com.id] = {
			html: com.innerHTML,
			contents: contents.value
		};

		$('com2').value = contents.value;
		com.style.height = '';
		com.style.height = Math.min(com.scrollHeight, Math.floor(viewportRect.height * 0.8)) + 'px';
	}

	function updateInfo () {
		empty('comment-info-details');

		const summary = $('comment-info-summary');
		if (items.reduce(updateInfoCore, false)) {
			summary.classList.add('blink');
		}
		else {
			summary.classList.remove('blink');
		}
	}

	function register (tag, fn, e) {
		if (timers[tag]) {
			clearTimeout(timers[tag]);
			delete timers[tag];
		}
		if (typeof fn == 'function') {
			timers[tag] = setTimeout(e => {
				delete timers[tag];
				fn(e);
			}, 50, e);
		}
	}

	function isFileElementReady () {
		const upfile = $('upfile');
		if (!upfile) return false;
		if (upfile.disabled) return false;
		if (upfile.getAttribute('data-origin') == 'js') return false;
		if (upfile.getAttribute('data-pasting')) return false;
		return true;
	}

	function isTegakiElementReady () {
		const baseform = document.getElementsByName('baseform')[0];
		if (!baseform) return false;
		return true;
	}

	function findAcceptableFile (files) {
		const availableTypes = [
			'image/jpg', 'image/jpeg',
			'image/png',
			'image/gif',
			'image/webp',
			'video/webm',
			'video/mp4',
			'video/x-m4v'
		];
		return Array.prototype.reduce.call(files, (file, f) => {
			if (file) return file;
			if (availableTypes.indexOf(f.type) >= 0) return f;
			return null;
		}, null);
	}

	function dumpElement (head, elm, ...rest) {
		const logs = [];
		for (; elm; elm = elm.parentNode) {
			switch (elm.nodeType) {
			case 1: // ELEMENT_NODE
				{
					let result = elm.tagName;
					if (elm.id != '') {
						result += `#${elm.id}`;
					}
					if (elm.className != '') {
						result += '.' + elm.className.replace(/\s+/g, '.');
					}
					logs.push(result);
				}
				break;
			case 3: // TEXT_NODE
				logs.push(`"${elm.nodeValue}"`);
				break;
			case 9: // DOCUMENT_NODE
				logs.push('#document');
				break;
			default:
				logs.push(elm.nodeName);
				break;
			}
		}
		console.log(`${head}: ${logs.join(' → ')}: ${rest.join(' ')}`);
	}

	function pasteText (e, text) {
		document.execCommand('insertText', false, text);
	}

	async function encodeJpeg (canvas, maxSize) {
		let result;
		let quality = 10;
		for (let quality = 9; quality > 0; quality--) {
			result = await getBlobFrom(canvas, 'image/jpeg', quality / 10);
			if (result.size <= maxSize) {
				break;
			}
		}
		if (result) {
			overrideUpfile.data = result;
		}
		else {
			const message = 'JPEG エンコードしてもファイルが大きすぎます';
			setBottomStatus(message);
			throw new Error(message);
		}
	}

	function pasteFile (e, file) {
		overrideUpfile = undefined;
		if (!file) return;

		const canUpload = isFileElementReady();
		const canTegaki = isTegakiElementReady();
		if (!canUpload && !canTegaki) return;

		const upfile = $('upfile');
		let resetItems = ['textonly'];
		let p;

		switch (e.type) {
		case 'paste':
			upfile.setAttribute('data-pasting', '1');
			setBottomStatus('画像を貼り付けています...', true);
			break;

		default: // change, drop, ...
			setBottomStatus('サムネイルを生成しています...', true);
			break;
		}

		/*
		 * IMPORTANT: WHICH ELEMENTS SHOULD BE RESET?
		 *
		 * from change event, and...
		 *   pseudo reply image: upfile, (overrideUpfile)
		 *      too large image: upfile, baseform
		 *               others: baseform, (overrideUpfile)
		 *
		 * from drop event, and...
		 *   pseudo reply image: upfile, (overrideUpfile)
		 *      too large image: upfile, baseform
		 *               others: upfile, baseform
		 *
		 * from paste event, and...
		 *   pseudo reply image: upfile, (overrideUpfile)
		 *      too large image: upfile, baseform
		 *               others: upfile, baseform
		 */

		// pseudo reply image
		if (!canUpload && canTegaki) {
			if (!devMode) {
				alert('ん？');
				return;
			}

			// only image can post as reply
			if (!file.type.startsWith('image/')) {
				setBottomStatus('画像以外のファイルは添付できません');
				return;
			}

			p = getImageFrom(file).then(img => {
				if (!img) return;

				const canvas = $qs('#draw-wrap .draw-canvas');
				const size = getThumbnailSize(
					img.naturalWidth, img.naturalHeight,
					storage.config.tegaki_max_width.value,
					storage.config.tegaki_max_height.value);
				canvas.width = size.width;
				canvas.height = size.height;

				const c = canvas.getContext('2d');
				//c.fillStyle = '#000000';
				//c.fillRect(0, 0, canvas.width, canvas.height);
				c.clearRect(0, 0, canvas.width, canvas.height);
				c.drawImage(
					img,
					0, 0, img.naturalWidth, img.naturalHeight,
					0, 0, canvas.width, canvas.height);

				const baseform = document.getElementsByName('baseform')[0];
				baseform.value = canvas.toDataURL().replace(/^[^,]+,/, '');
				$('draw-wrap').setAttribute('data-persists', 'canvas-initialized');

				resetItems.push('upfile');
				overrideUpfile = undefined;

				return setPostThumbnail(canvas, '疑似画像レス');
			});
		}

		// too large file size: re-encode to jpeg
		else if (siteInfo.maxAttachSize && file.size > siteInfo.maxAttachSize) {
			// we can not handle videos that are to large
			if (!file.type.startsWith('image/')) {
				setBottomStatus('ファイルが大きすぎます');
				return;
			}

			p = getImageFrom(file).then(img => {
				if (!img) return;

				const canvas = document.createElement('canvas');
				canvas.width = img.naturalWidth;
				canvas.height = img.naturalHeight;

				const c = canvas.getContext('2d');
				c.fillStyle = '#000000';
				c.fillRect(0, 0, canvas.width, canvas.height);
				c.drawImage(img, 0, 0);

				resetItems.push('upfile', 'baseform');

				return Promise.all([
					setPostThumbnail(canvas, '再エンコードJPEG'),
					encodeJpeg(canvas, siteInfo.maxAttachSize)
				]);
			});
		}

		// normal upload
		else {
			p = setPostThumbnail(file);
			if (e.type == 'change') {
				resetItems.push('baseform');
				overrideUpfile = undefined;
			}
			else {
				resetItems.push('upfile', 'baseform');
			}
		}

		overrideUpfile = {
			name: file.name,
			data: file
		};

		p = p.finally(() => {
			setBottomStatus();
			resetForm.apply(null, resetItems);
			upfile.removeAttribute('data-pasting');
			p = null;
		});
	}

	/*
	 * drag and drop handlers
	 */

	function handleDragOver (e) {
		if (!e.dataTransfer || !e.dataTransfer.items) return;
		if (!findAcceptableFile(e.dataTransfer.items)) return;

		e.preventDefault();
		//dumpElement('    dragover', e.target);

		register('dnd', () => {
			if (!$('postform-wrap').classList.contains('hover')) {
				commands.activatePostForm('postform-wrap#dragover');
			}
			if ($('postform-drop-indicator').classList.contains('hide')) {
				$('postform-drop-indicator').classList.remove('hide');
			}
		});
	}

	function handleDragEnter (e) {
		e.preventDefault();
		//dumpElement('    dragenter', e.target);
	}

	function handleDragLeave (e) {
		//dumpElement('    dragleave', e.target, `target:${Object.prototype.toString.call(e.target)}, relatedTarget:${Object.prototype.toString.call(e.relatedTarget)}`);

		if (!e.relatedTarget) {
			register('dnd', () => {
				if ($('postform-wrap').classList.contains('hover')) {
					commands.deactivatePostForm().then(() => {
						$('postform-drop-indicator').classList.add('hide');
					});
				}
			});
		}
	}

	function handleDrop (e) {
		e.preventDefault();
		register('dnd');
		//dumpElement('    drop');
		$('postform-drop-indicator').classList.add('hide');
		handleTextAreaPaste(e);
		$('com').focus();
	}

	/*
	 * misc handlers
	 */

	function handleTextAreaPaste (e) {
		const dataTransfer = e.clipboardData || e.dataTransfer;
		if (!dataTransfer) return;

		let data;
		if (dataTransfer.files
		&& dataTransfer.files.length
		&& (data = findAcceptableFile(dataTransfer.files))) {
			e.preventDefault();
			return pasteFile(e, data);
		}
		else if ((data = dataTransfer.getData('text/plain')) != '') {
			e.preventDefault();
			return pasteText(e, data);
		}
	}

	function registerTextAreaHeightAdjuster (e) {
		register('textarea', adjustTextAreaHeight, e);
	}

	function registerUpdateInfo (e) {
		register('input', updateInfo, e);
	}

	/*
	 * init
	 */

	items.forEach(item => {
		const el = $(item.id);
		if (!el) return;

		if (el.nodeName == 'TEXTAREA' || el.contentEditable == 'true') {
			el.addEventListener('input', registerTextAreaHeightAdjuster);
			el.addEventListener('compositionend', adjustTextAreaHeight);
			el.addEventListener('paste', handleTextAreaPaste);
		}
		else {
			el.addEventListener('paste', registerUpdateInfo);
		}

		el.addEventListener('input', registerUpdateInfo);
	});

	document.addEventListener('dragover', handleDragOver);
	document.addEventListener('dragenter', handleDragEnter, true);
	document.addEventListener('dragleave', handleDragLeave, true);
	document.addEventListener('drop', handleDrop);

	$qsa('#com').forEach(com => {
		updateInfo();
	});

	$qsa('#upfile').forEach(upfile => {
		upfile.addEventListener('change', e => {
			pasteFile(e, e.target.files[0]);
		});
	});
}

function setupWheelReload () {
	let accum = 0;
	let lastWheeled = 0;

	function preventDefault (e) {
		/*
		 * From Chrome 73, document level wheel event will be treated as passive:
		 * https://www.chromestatus.com/features/6662647093133312
		 */
		try {
			e.preventDefault();
		}
		catch (ex) {
			;
		}
	}

	function handler (e) {
		if (transport.isRunning()) {
			return;
		}

		if (e.target.classList.contains('dialog-content-wrap')) {
			preventDefault(e);
			return;
		}

		if (e.target.closest('#panel-aside-wrap')) {
			e.stopPropagation();
			return;
		}

		const now = Date.now();
		const st = docScrollTop();
		const sh = document.documentElement.scrollHeight;

		let wheelDelta = e.deltaY;

		if (wheelDelta < 0 || st < sh - viewportRect.height) {
			lastWheeled = now;
			accum = 0;
			setWheelStatus();
			return;
		}

		const factor = storage.config.wheel_reload_threshold_override.value;
		const threshold = storage.config.wheel_reload_unit_size.value * factor;

		if (wheelDelta == 0) {
			wheelDelta = threshold;
		}

		if (now - lastWheeled >= 500) {
			lastWheeled = now;
			accum = 0;
			setWheelStatus();
		}

		accum += Math.abs(wheelDelta);

		if (accum < threshold) {
			setWheelStatus(`リロードぢから：${Math.min(Math.floor(accum / threshold * 100), 99)}%`);
			return;
		}

		lastWheeled = now;
		accum = 0;
		preventDefault(e);
		setWheelStatus();
		commands.reload();
	}

	window.addEventListener('wheel', handler, {passive: false});
}

function setupCustomEventHandler () {
	const wheelHideIntervalMsecs = 1000 * 3;
	const navHideIntervalMsecs = 1000 * 2;

	let wheelStatusHideTimer;
	let navStatusHideTimer;
	let shrinkChars;

	document.addEventListener(`${APP_NAME}.wheelStatus`, e => {
		if ($qs('#dialog-wrap:not(.hide)')) return;

		const ws = $('wheel-status');
		if (!ws) return;

		const s = e.detail.message;
		if (!s || s == '') {
			ws.classList.add('hide');
		}
		else {
			ws.classList.remove('hide');
			$t($qs('.wheel-status-text', ws), s);
			if (wheelStatusHideTimer) {
				clearTimeout(wheelStatusHideTimer);
				wheelStatusHideTimer = null;
			}
			wheelStatusHideTimer = setTimeout(() => {
				wheelStatusHideTimer = null;
				ws.classList.add('hide');
			}, wheelHideIntervalMsecs);
		}
	}, false);

	document.addEventListener(`${APP_NAME}.bottomStatus`, e => {
		if ($qs('#dialog-wrap:not(.hide)')) return;

		const nav = $('nav-normal');
		const ns = $('nav-status');
		if (!nav || !ns) return;

		const s = e.detail.message || '';
		let persistent = !!e.detail.persistent;
		let interval = navHideIntervalMsecs;

		if (navStatusHideTimer) {
			clearTimeout(navStatusHideTimer);
			navStatusHideTimer = null;
		}

		if (s == '') {
			shrinkChars = Array.from($qs('.wheel-status-text', ns).textContent);
			persistent = false;
			interval = 0;
		}
		else {
			shrinkChars = Array.from(s);
		}

		nav.classList.add('hide');
		ns.classList.remove('hide');
		$t($qs('.wheel-status-text', ns), shrinkChars.join(''));

		if (!persistent) {
			navStatusHideTimer = setTimeout(() => {
				navStatusHideTimer = null;

				window.requestAnimationFrame(function handleShrink () {
					if (!ns.classList.contains('hide') && shrinkChars && shrinkChars.length) {
						shrinkChars.pop();
						$t($qs('.wheel-status-text', ns), shrinkChars.join(''));
						window.requestAnimationFrame(handleShrink);
					}
					else {
						nav.classList.remove('hide');
						ns.classList.add('hide');
						shrinkChars = null;
					}
				});
			}, interval);
		}
	}, false);
}

function setupSearchResultPopup () {
	let timer;

	function hover (e) {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		timer = setTimeout(target => {
			timer = null;

			let element = document.elementFromPoint(cursorPos.x, cursorPos.y);
			while (element) {
				if (element.nodeName == 'A') break;
				element = element.parentNode;
			}

			if (element == target) {
				const panelRect = $('panel-aside-wrap').getBoundingClientRect();
				const targetRect = target.getBoundingClientRect();
				const originNumber = target.getAttribute('data-number');
				const originElement = getWrapElement($qs(`#_${originNumber}, [data-number="${originNumber}"]`));
				const popup = quotePopup.createPopup({element: originElement}, 'quote-popup-pool2');
				popup.querySelector('.comment').style = '';
				popup.style.left = (panelRect.left - 8 - popup.offsetWidth) + 'px';
				popup.style.top = Math.min(targetRect.top, viewportRect.height - popup.offsetHeight - 8) + 'px';
				popup.id = 'search-popup';
			}
		}, QUOTE_POPUP_DELAY_MSEC, e.target);
	}

	function leave (e) {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		const popup = $('search-popup');
		if (popup) {
			popup.parentNode.removeChild(popup);
		}
	}

	if (siteInfo.resno) {
		setupMouseHoverEvent('search-result', 'a', hover, leave);
		setupMouseHoverEvent('panel-content-mark', 'a', hover, leave);
	}
}

/*
 * <<<1 modal dialog functions
 */

function modalDialog (opts) {
	let dialogWrap;
	let contentWrap;
	let content;
	let dimmer;
	let state = 'initializing';
	let isPending = false;
	let scrollTop = docScrollTop();

	function getRemoteController (type) {
		return {
			get type () {return type},
			get content () {return content},
			get isPending () {return isPending},
			set isPending (v) {isPending = !!v},
			initTitle, initButtons, enableButtons, disableButtonsWithout, initFromXML,
			close: () => {
				isPending = false;
				leave();
			}
		};
	}

	function init () {
		dialogWrap = $('dialog-wrap');
		if (!dialogWrap) return;

		appStates.unshift('dialog');

		contentWrap = $qs('.dialog-content-wrap', dialogWrap);
		content = $qs('.dialog-content', dialogWrap);
		dimmer = $qs('.dimmer', dialogWrap);
		if (!contentWrap || !content || !dimmer) return;
		if (!dialogWrap.classList.contains('hide')) return;

		dialogWrap.classList.remove('hide');
		empty(content);
		initTitle(opts.title);
		initButtons(opts.buttons);
		opts.oninit && opts.oninit(getRemoteController('init'));
		startTransition();
	}

	function initTitle (opt) {
		const title = $qs('.dialog-content-title', dialogWrap);
		if (!title) return;
		title.textContent = opt != undefined ? opt : 'dialog';
	}

	function initButtons (opt) {
		const footer = $qs('.dialog-content-footer', dialogWrap);
		if (!footer) return;

		const buttons = [];

		while (footer.childNodes.length) {
			if (footer.firstChild.nodeName == 'A') {
				buttons.push(footer.firstChild);
				footer.firstChild.classList.remove('disabled');
			}
			footer.removeChild(footer.firstChild);
		}

		(opt || '').split(/\s*,\s*/).forEach(opt => {
			buttons.forEach((button, i) => {
				if (!button) return;
				if (button.getAttribute('href') != `#${opt}-dialog`) return;
				button.classList.remove('hide');
				footer.appendChild(button);
				buttons[i] = null;
			});
		});

		buttons.forEach(button => {
			if (!button) return;
			button.classList.add('hide');
			footer.appendChild(button);
		});
	}

	function initFromXML (xml, xslName) {
		if (state != 'initializing') return;
		if (isPending) return;
		resources.get(
			`/xsl/${xslName}.xsl`,
			{expires:DEBUG_ALWAYS_LOAD_XSL ? 1 : 1000 * 60 * 60}
		).then(xsl => {
			const p = new window.XSLTProcessor;

			try {
				let f;

				try {
					xsl = (new window.DOMParser()).parseFromString(xsl, "text/xml");
				}
				catch (e) {
					console.error(`${APP_NAME}: xsl parsing failed: ${e.stack}`);
					return;
				}

				try {
					p.importStylesheet(xsl);
				}
				catch (e) {
					console.error(`${APP_NAME}: importStylesheet failed: ${e.stack}`);
					return;
				}

				try {
					f = fixFragment(p.transformToFragment(xml, document));
				}
				catch (e) {
					console.error(`${APP_NAME}: transformToFragment failed: ${e.stack}`);
					return;
				}

				extractDisableOutputEscapingTags(content, f);
			}
			finally {
				isPending = false;
				startTransition();
			}
		});
		isPending = true;
	}

	function startTransition () {
		if (isPending) return;
		if (state != 'initializing') return;

		clickDispatcher
			.add('#apply-dialog', handleApply)
			.add('#ok-dialog', handleOk)
			.add('#cancel-dialog', handleCancel);

		keyManager
			.addStroke('dialog', '\u001b', handleCancel)
			.addStroke('dialog', '\u000d', handleOk)
			.addStroke('dialog.edit', ['\u000d', '<S-enter>'], (e, t) => {
				if (t.nodeName != 'TEXTAREA'
				|| !t.classList.contains('config-item')) {
					return keyManager.PASS_THROUGH;
				}
			});

		contentWrap.addEventListener('mousedown', handleMouseCancel, false);
		contentWrap.addEventListener('mousemove', handleMouseCancel, false);
		contentWrap.addEventListener('mouseup', handleMouseCancel, false);

		opts.onopen && opts.onopen(getRemoteController('open'));
		state = 'running';

		setTimeout(() => {
			window.scrollTo(0, scrollTop);
			contentWrap.classList.add('run');
			dimmer.classList.add('run');
		}, 0);
	}

	function enableButtons () {
		$qsa('.dialog-content-footer a', dialogWrap).forEach(node => {
			node.classList.remove('disabled');
		});
	}

	function disableButtonsWithout (exceptId) {
		$qsa('.dialog-content-footer a', dialogWrap).forEach(node => {
			if (exceptId && node.href.indexOf(`#${exceptId}-dialog`) < 0) {
				node.classList.add('disabled');
			}
		});
	}

	function isDisabled (node) {
		let result = false;
		for (; node; node = node.parentNode) {
			if (node.nodeName == 'A') {
				break;
			}
		}
		if (node) {
			result = node.classList.contains('disabled');
		}
		return result;
	}

	function handleApply (e) {
		if (state != 'running') return;
		if (isDisabled(e.target)) return;
		disableButtonsWithout('apply');
		opts.onapply && opts.onapply(getRemoteController('apply'));
	}

	function handleOk (e) {
		if (state != 'running') return;
		if (isDisabled(e.target)) return;
		disableButtonsWithout('ok');

		let canLeave = true;
		if (opts.onok) {
			if (opts.onok(getRemoteController('ok')) === false) {
				canLeave = false;
			}
		}
		if (canLeave) {
			leave();
		}
		else {
			enableButtons();
		}
	}

	function handleCancel (e) {
		if (state != 'running') return;
		if (isDisabled(e.target)) return;
		disableButtonsWithout('cancel');

		let canLeave = true;
		if (opts.oncancel) {
			if (opts.oncancel(getRemoteController('cancel')) === false) {
				canLeave = false;
			}
		}
		if (canLeave) {
			leave();
		}
		else {
			enableButtons();
		}
	}

	function handleMouseCancel (e) {
		if (e.target == e.currentTarget) {
			e.preventDefault();
			e.stopPropagation();
		}
	}

	function leave () {
		if (state != 'running') return;
		if (isPending) return;

		clickDispatcher
			.remove('#apply-dialog')
			.remove('#ok-dialog')
			.remove('#cancel-dialog');

		keyManager.removeStroke('dialog');

		contentWrap.removeEventListener('mousedown', handleMouseCancel, false);
		contentWrap.removeEventListener('mousemove', handleMouseCancel, false);
		contentWrap.removeEventListener('mouseup', handleMouseCancel, false);

		transitionend(contentWrap, () => {
			opts.onclose && opts.onclose(content);
			dialogWrap.classList.add('hide');
			dialogWrap = contentWrap = content = dimmer = null;
			appStates.shift();
		});

		setTimeout(() => {
			contentWrap.classList.remove('run');
			dimmer.classList.remove('run');
		}, 0);
	}

	opts || (opts = {});
	init();
}

/*
 * <<<1 application independent utility functions
 */

let $, $t, $qs, $qsa, empty, fixFragment, serializeXML, getCookie, setCookie,
	getDOMFromString, getImageMimeType, docScrollTop, docScrollLeft,
	transitionend, delay, transitionendp, dumpNode, getBlobFrom, getImageFrom,
	getReadableSize, regalizeEditable, getContentsFromEditable,
	setContentsToEditable, isHighSurrogate, isLowSurrogate, isSurrogate,
	resolveCharacterReference, 新字体の漢字を舊字體に変換, osaka, mergeDeep,
	getErrorDescription, load, substringWithStrictUnicode, invokeMousewheelEvent,
	voice;

/*
 * <<<1 application depending misc functions
 */

function modules (...args) {
	if (args.length == 1) {
		return import(chrome.runtime.getURL(`lib/${args[0]}.js`));
	}
	else {
		return Promise.all(args.map(name => modules(name)));
	}
}

function extractDisableOutputEscapingTags (container, extraFragment) {
	container = $(container);
	if (!container) return;
	if (extraFragment) container.appendChild(extraFragment);
	$qsa('[data-doe]', container).forEach(node => {
		const doe = node.getAttribute('data-doe');
		node.removeAttribute('data-doe');
		node.insertAdjacentHTML('beforeend', doe);
	});
	return container;
}

function resolveRelativePath (url, baseUrl) {
	// full path
	if (/^(\w+:)?\/\//.test(url)) {
		return url;
	}

	// absolute path
	else if (/^\//.test(url)) {
		return `${location.protocol}//${location.host}${url}`;
	}

	// relative path
	if (baseUrl == undefined) {
		baseUrl = (document.getElementsByTagName('base')[0] || location).href;
	}
	baseUrl = baseUrl.replace(/\/[^\/]*$/, '/');
	return baseUrl + url;
}

function setBoardCookie (key, value, lifeDays) {
	setCookie(key, value, lifeDays, `/${siteInfo.board}`);
}

function getCatalogSettings () {
	let data = getCookie('cxyl');
	if (data == undefined) {
		data = [15, 5, 0];
	}
	else {
		data = data.split('x').map(a => a - 0);
	}
	return data;
}

function setBottomStatus (s, persistent) {
	const ev = new CustomEvent(`${APP_NAME}.bottomStatus`, {
		bubbles: true,
		cancelable: true,
		detail: {
			message: s || '',
			persistent: !!persistent
		}
	});
	document.dispatchEvent(ev);
}

function setWheelStatus (s) {
	const ev = new CustomEvent(`${APP_NAME}.wheelStatus`, {
		bubbles: true,
		cancelable: true,
		detail: {
			message: s || ''
		}
	});
	document.dispatchEvent(ev);
}

function getWrapElement (element) {
	return element ? element.closest('.topic-wrap, .reply-wrap') : null;
}

function getPostNumber (element) {
	let result;

	for (; element; element = element.parentNode) {
		const n = element.getAttribute('data-number');
		if (n) {
			result = n - 0;
		}
		if (element.classList.contains('topic-wrap')
		|| element.classList.contains('reply-wrap')) {
			if (result == undefined) {
				result = $qs('[data-number]', element).getAttribute('data-number') - 0;
			}
			return result;
		}
	}

	return null;
}

function getTextForCatalog (text, maxLength) {
	let score = 0;
	let result = '';
	for (let ch of text) {
		// assign 0.5 point for half width kana
		const s = /[\uff61-\uffdc\uffe8-\uffee]/.test(ch) ? .5 : 1;

		if (score >= maxLength || score + s > maxLength) break;
		result += ch;
		score += s;
	}
	return result;
}

function sanitizeComment (commentNode) {
	const result = commentNode.cloneNode(true);

	/*
	$qsa('.link-siokara', result).forEach(node => {
		const anchor = node.nodeName == 'A' ? node : $qs('a', node);
		if (anchor) {
			node.parentNode.replaceChild(
				document.createTextNode(anchor.textContent),
				node);
		}
	});
	*/

	const strippedItems = [
		'video',
		'audio',
		'iframe',
		'.inline-save-image-wrap',
		//'.siokara-media-container',
		'.up-media-container'
	];
	$qsa(strippedItems.join(','), result).forEach(node => {
		node.parentNode && node.parentNode.removeChild(node);
	});

	return result;
}

function commentToString (container) {
	container = sanitizeComment(container);

	const iterator = document.createNodeIterator(
		container, window.NodeFilter.SHOW_ELEMENT | window.NodeFilter.SHOW_TEXT);
	const result = [];
	let currentNode;
	while ((currentNode = iterator.nextNode())) {
		switch (currentNode.nodeType) {
		case 1:
			if (currentNode.nodeName == 'IMG') {
				result.push(currentNode.getAttribute('alt') || '');
			}
			break;

		case 3:
			result.push(currentNode.nodeValue);
			break;
		}
	}

	return result.join('').replace(/^\s+|\s+$/g, '');
}

function rangeToString (range) {
	const container = document.createElement('div');
	container.appendChild(range.cloneContents());
	return commentToString(container);
}

function getPostTimeRegex () {
	return /(\d+)\/(\d+)\/(\d+)\(.\)(\d+):(\d+):(\d+)/;
}

function displayLightbox (anchor) {
	return modules('lightbox').then(module => {
		return new Promise(resolve => {
			module.lightbox({
				clickDispatcher, keyManager, storage,
				onenter: () => {
					appStates.unshift('lightbox');
					selectionMenu.enabled = false;
				},
				onleave: () => {
					selectionMenu.enabled = true;
					appStates.shift();
					resolve();
				},
				onsearch: imageSource => {
					const lang = window.navigator.browserLanguage
						|| window.navigator.language
						|| window.navigator.userLanguage;
					const url = 'http://www.google.com/searchbyimage'
						+ `?sbisrc=${APP_NAME}`
						+ `&hl=${lang.toLowerCase()}`
						+ `&image_url=${encodeURIComponent(imageSource)}`;
					backend.send('open', {
						url: url,
						selfUrl: location.href
					});
				},
				oncopy: canvas => {
					getBlobFrom(canvas).then(blob => {
						navigator.clipboard.write([
							new ClipboardItem({
								[blob.type]: blob
							})
						]);
						sounds.imageSaved.play();
					});
				},
				get viewportRect () {
					return viewportRect;
				}
			}).start(anchor);
		});
	});
}

function displayInlineVideo (anchor) {
	function createMedia () {
		const media = document.createElement('video');
		const props = {
			autoplay: true,
			controls: true,
			loop: false,
			muted: false,
			src: anchor.href,
			volume: storage.runtime.media.volume
		};

		for (let i in props) {
			media[i] = props[i];
		}
		media.style.maxWidth = INLINE_VIDEO_MAX_WIDTH;
		media.style.maxHeight = INLINE_VIDEO_MAX_HEIGHT;
		media.style.width = '100%';
		media.addEventListener('volumechange', e => {
			storage.runtime.media.volume = e.target.volume;
			storage.saveRuntime();
		});

		return media;
	}

	let parent;

	// siokara video
	/*
	if ((parent = anchor.closest('.link-siokara'))) {
		const firstAnchor = $qs('a', parent);
		const thumbContainer = $qs('.siokara-thumbnail', parent);

		if (firstAnchor && thumbContainer) {
			if ($qs('video', parent)) {
				$qsa('.siokara-media-container', parent).forEach(node => {
					node.parentNode.removeChild(node);
				});
				thumbContainer.classList.remove('hide');
			}
			else {
				const mediaContainer = document.createElement('div');
				thumbContainer.classList.add('hide');
				firstAnchor.parentNode.insertBefore(mediaContainer, firstAnchor.nextSibling);
				mediaContainer.className = 'siokara-media-container';
				mediaContainer.appendChild(createMedia());
			}
		}
		else if (anchor.closest('q')) {
			if ($qs('video', anchor)) {
				$qsa('.siokara-media-container', parent).forEach(node => {
					node.parentNode.removeChild(node);
				});
			}
			else {
				const mediaContainer = document.createElement('div');
				anchor.appendChild(mediaContainer);
				mediaContainer.className = 'siokara-media-container';
				mediaContainer.appendChild(createMedia());
			}
		}
	}
	*/

	// up video
	if ((parent = anchor.closest('.link-up, .link-futaba'))) {
		let thumbContainer = anchor;

		if (!$qs('img', anchor)) {
			thumbContainer = thumbContainer.nextSibling;
			while (thumbContainer) {
				if (thumbContainer.nodeName == 'A' && thumbContainer.href == anchor.href) {
					break;
				}
				thumbContainer = thumbContainer.nextSibling;
			}
		}

		if (thumbContainer) {
			if (thumbContainer.previousSibling.nodeName == 'VIDEO') {
				thumbContainer.parentNode.removeChild(thumbContainer.previousSibling);
				thumbContainer.classList.remove('hide');
			}
			else {
				thumbContainer.classList.add('hide');
				thumbContainer.parentNode.insertBefore(createMedia(), thumbContainer);
			}
		}
		else {
			const quote = anchor.closest('q');
			if (!quote) return;
			if (quote.nextSibling && quote.nextSibling.nodeName == 'VIDEO') {
				quote.parentNode.removeChild(quote.nextSibling);
			}
			else {
				quote.parentNode.insertBefore(createMedia(), quote.nextSibling);
			}
		}
	}

	// topic video
	else if ((parent = anchor.closest('a'))) {
		const thumbContainer = $qs('img', parent);
		if (parent.previousSibling && parent.previousSibling.nodeName == 'VIDEO') {
			parent.parentNode.removeChild(parent.previousSibling);
			thumbContainer.classList.remove('hide');
		}
		else {
			const mediaContainer = document.createElement('div');
			thumbContainer.classList.add('hide');
			parent.parentNode.insertBefore(createMedia(), parent);
		}
	}
}

function displayInlineAudio (anchor) {
	function createMedia () {
		const media = document.createElement('audio');
		const props = {
			autoplay: true,
			controls: true,
			loop: false,
			muted: false,
			src: anchor.href,
			volume: storage.runtime.media.volume
		};

		for (let i in props) {
			media[i] = props[i];
		}
		media.addEventListener('volumechange', e => {
			storage.runtime.media.volume = e.target.volume;
			storage.saveRuntime();
		});

		return media;
	}

	let parent;

	// siokara audio
	/*
	if ((parent = anchor.closest('.link-siokara'))) {
		const firstAnchor = $qs('a', parent);
		const thumbContainer = $qs('.siokara-thumbnail', parent);

		if (firstAnchor && thumbContainer) {
			if ($qs('audio', parent)) {
				$qsa('.siokara-media-container', parent).forEach(node => {
					node.parentNode.removeChild(node);
				});
				thumbContainer.classList.remove('hide');
			}
			else {
				const mediaContainer = document.createElement('div');
				thumbContainer.classList.add('hide');
				firstAnchor.parentNode.insertBefore(mediaContainer, firstAnchor.nextSibling);
				mediaContainer.className = 'siokara-media-container';
				mediaContainer.appendChild(createMedia());
			}
		}
		else if (anchor.closest('q')) {
			if ($qs('audio', anchor)) {
				$qsa('.siokara-media-container', parent).forEach(node => {
					node.parentNode.removeChild(node);
				});
			}
			else {
				const mediaContainer = document.createElement('div');
				anchor.appendChild(mediaContainer);
				mediaContainer.className = 'siokara-media-container';
				mediaContainer.appendChild(createMedia());
			}
		}
	}
	*/

	// up audio
	if ((parent = anchor.closest('.link-up'))) {
		const neighbor = anchor.nextElementSibling;

		if (neighbor && neighbor.classList.contains('up-media-container')) {
			neighbor.parentNode.removeChild(neighbor);
		}
		else {
			const mediaContainer = document.createElement('div');
			anchor.parentNode.insertBefore(mediaContainer, neighbor);
			mediaContainer.className = 'up-media-container';
			mediaContainer.appendChild(createMedia());
		}
	}
}

function execEditorCommand (name, e) {
	if (storage.config.hook_edit_shortcuts.value) {
		if (editorHelper) {
			return editorHelper[name](e);
		}
		else {
			modules('editor-helper').then(module => {
				editorHelper = module.createEditorHelper();
				editorHelper[name](e);
			});
		}
	}
	else {
		return keyManager.PASS_THROUGH;
	}
}

function getVersion () {
	let app, machine = [];

	const ua = navigator.userAgent;
	if (typeof InstallTrigger == 'object' && /\bfirefox\/(\d+(?:\.\d+)*)/i.test(ua)) {
		app = `Firefox/${RegExp.$1}`;
	}
	else if (/\bvivaldi\/(\d+(?:\.\d+)*)/i.test(ua)) {
		app = `Vivaldi/${RegExp.$1}`;
	}
	else if (/\bopr\/(\d+(?:\.\d+)*)/i.test(ua)) {
		app = `Opera/${RegExp.$1}`;
	}
	else if (/\bchromium\/(\d+(?:\.\d+)*)/i.test(ua)) {
		app = `Chromium/${RegExp.$1}`;
	}
	else if (/\bchrome\/(\d+(?:\.\d+)*)/i.test(ua)) {
		app = `Chrome/${RegExp.$1}`;
	}

	if (backend.browserInfo.name && backend.browserInfo.version) {
		app = `${backend.browserInfo.name}/${backend.browserInfo.version}`;
	}
	else if (backend.browserInfo.name) {
		app = backend.browserInfo.name;
	}

	'platform' in navigator && machine.push(navigator.platform);
	'deviceMemory' in navigator && machine.push(`${navigator.deviceMemory}GB`);
	'hardwareConcurrency' in navigator && machine.push(`${navigator.hardwareConcurrency}CPUs`);

	return `akahukuplus/${version} on ${app} (${machine.join(', ')})`;
}

function dumpDebugText (text) {
	if (!devMode) return;

	const ID = 'akahukuplus-debug-dump-container';
	let node = $(ID);

	if (text != undefined) {
		if (!node) {
			node = document.body.appendChild(document.createElement('pre'));
			node.id = ID;
			node.style.fontFamily = 'Consolas,monospace';
			node.style.whiteSpace = 'pre-wrap';
			node.style.wordBreak = 'break-all';
		}
		empty(node);
		node.appendChild(document.createTextNode(text));
	}
	else {
		if (node) {
			node.parentNode.removeChild(node);
		}
	}
}

/*
 * <<<1 functions for posting
 */

function populateTextFormItems (form, callback, populateAll) {
	const inputNodes = $qsa([
		'input[type="hidden"]',
		'input[type="text"]',
		'input[type="number"]',
		'input[type="password"]',
		`input[type="checkbox"]${populateAll ? '' : ':checked'}`,
		'input[type="radio"]:checked',
		'textarea',
		'select'
	].join(','), form);

	inputNodes.forEach(node => {
		if (node.name == '') return;
		if (node.disabled) return;
		callback(node);
	});
}

function populateFileFormItems (form, callback) {
	const inputNodes = $qsa([
		'input[type="file"]'
	].join(','), form);

	inputNodes.forEach(node => {
		if (node.name == '') return;
		if (node.disabled) return;
		if (node.files.length == 0) return;
		callback(node);
	});
}

function postBase (type, form) { /*returns promise*/

	function reverseText (s) {
		const result = [];
		for (const ch of s) {
			result.push(ch)
		}
		return result.reverse().join('');
	}

	function getIconvPayload (form) {
		const payload = {};

		populateTextFormItems(form, node => {
			let content = node.value;

			if (/![旧舊]字[体體]!/.test($('email').value)) {
				content = 新字体の漢字を舊字體に変換(content);
				if (node.id == 'email') {
					content = content.replace(/![旧舊]字[体體]!\s*/g, '');
				}
			}
			if (/!rtl!/.test($('email').value)) {
				if (node.id == 'email') {
					content = content.replace(/!rtl!\s*/g, '');
				}
				if (node.id == 'com2' || node.id == 'email') {
					content = content
						.split(/\r?\n/)
						.map(line => /^>/.test(line) ? line : reverseText(line))
						.join('\n');
				}
			}
			if (storage.config.osaka_conversion.value || /!osaka!/.test($('email').value)) {
				content = content
					.split(/\r?\n/)
					.map(line => /^>/.test(line) ? line : osaka(line))
					.join('\n');
				if (node.id == 'email') {
					content = content.replace(/!osaka!\s*/g, '');
				}
			}

			payload[node.name] = content;
		});

		// process command tags !TAG! in comment
		if ('com' in payload) {
			const commands = {};
			let com = payload['com'].replace(/\r\n/g, '\n');
			let re;
			try {
				while (re = /^!(email|sub|name|trad|[旧舊]字[体體]|rtl|osaka)!([^\n]*)\n/.exec(com)) {
					const key = RegExp.$1.replace(/[旧舊]字[体體]/, 'trad');
					const value = RegExp.$2;
					commands[RegExp.$1] = RegExp.$2;
					com = com.substring(re[0].length);
				}

				if (/!version!\s*$/.test(com)) {
					commands['version'] = getVersion();
					com = com.replace(/!version!\s*$/, '');
				}

				for (const [key, value] of Object.entries(commands)) {
					switch (key) {
					case 'email':
					case 'sub':
					case 'name':
						if (value != '') {
							payload[key] = value;
						}
						break;

					case 'trad':
						com = 新字体の漢字を舊字體に変換(com);
						break;

					case 'osaka':
						com = com
							.split(/\r?\n/)
							.map(line => /^>/.test(line) ? line : osaka(line))
							.join('\n');
						break;

					case 'rtl':
						com = com
							.split(/\r?\n/)
							.map(line => /^>/.test(line) ? line : reverseText(line))
							.join('\n');
						break;

					case 'version':
						com += value;
						break;
					}
				}
			}
			finally {
				payload['com'] = com;
			}
		}

		return payload;
	}

	function getBoundary () {
		return '----------' +
			Math.floor(Math.random() * 0x80000000).toString(36) + '-' +
			Math.floor(Math.random() * 0x80000000).toString(36) + '-' +
			Math.floor(Math.random() * 0x80000000).toString(36);
	}

	function getMultipartFormData (items, boundary) {
		const data = [];

		for (let i in items) {
			const item = new Uint8Array(items[i]);
			data.push(
				`--${boundary}\r\n` +
				`Content-Disposition: form-data; name="${i}"\r\n\r\n`,
				item, '\r\n'
			);
		};

		populateFileFormItems(form, node => {
			data.push(
				`--${boundary}\r\n` +
				`Content-Disposition: form-data` +
				`; name="${node.name}"` +
				`; filename="${node.files[0].name.replace(/"/g, '`')}"\r\n` +
				`Content-Type: ${node.files[0].type}\r\n` +
				'\r\n',
				node.files[0],
				'\r\n'
			);
		});

		if (overrideUpfile) {
			data.push(
				`--${boundary}\r\n` +
				'Content-Disposition: form-data' +
				'; name="upfile"' +
				`; filename="${overrideUpfile.name}"\r\n` +
				`Content-Type: ${overrideUpfile.data.type}\n` +
				'\r\n',
				overrideUpfile.data,
				'\r\n'
			);
		}

		data.push(`--${boundary}--\r\n`);

		return new window.Blob(data);
	}

	function getUrlEncodedFormData (items) {
		const data = [];
		let delimiter = '';

		for (let i in items) {
			data.push(
				delimiter, i, '=',
				items[i].map(code => {
					if (code == 32) return '+';
					const ch = String.fromCharCode(code);
					return /[a-z0-9-_.!~*'()]/i.test(ch) ?
						ch : '%' + ('0' + code.toString(16).toUpperCase()).substr(-2);
				}).join('')
			);

			if (delimiter == '') {
				delimiter = '&';
			}
		}

		return data.join('');
	}

	function multipartPost (data, boundary) {
		return new Promise(resolve => {
			xhr.open('POST', form.action);
			xhr.setRequestHeader('Content-Type', `multipart/form-data;boundary=${boundary}`);
			xhr.overrideMimeType(`text/html;charset=${FUTABA_CHARSET}`);

			xhr.onload = () => {
				resolve(xhr.responseText);
			};

			xhr.onerror = () => {
				resolve();
			};

			xhr.onloadend = () => {
				xhr = form = null;
			};

			xhr.setRequestHeader('X-Requested-With', `${APP_NAME}/${version}`);
			xhr.send(data);
		});
	}

	function urlEncodedPost (data) {
		return new Promise(resolve => {
			xhr.open('POST', form.action);
			xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
			xhr.overrideMimeType(`text/html;charset=${FUTABA_CHARSET}`);

			xhr.onload = () => {
				resolve(xhr.responseText);
			};

			xhr.onerror = () => {
				resolve();
			};

			xhr.onloadend = () => {
				xhr = form = null;
			};

			xhr.setRequestHeader('X-Requested-With', `${APP_NAME}/${version}`);
			xhr.send(data);
		});
	}

	let xhr = transport.create(type);
	return backend.send('iconv', getIconvPayload(form)).then(response => {
		if (!response) {
			throw new Error('Failed to convert charset.');
		}

		if (form.enctype == 'multipart/form-data') {
			const boundary = getBoundary();
			const data = getMultipartFormData(response, boundary);
			return multipartPost(data, boundary);
		}
		else {
			const data = getUrlEncodedFormData(response);
			return urlEncodedPost(data);
		}
	});
}

function resetForm (...args) {
	const form = document.createElement('form');
	const elements = [];

	for (const arg of args) {
		const org = $(arg) || $qs(`#postform [name="${arg}"]`);
		if (org) {
			if (org.contentEditable == 'true') {
				empty(org);
			}
			else if (/^(?:text|hidden)$/i.test(org.type)) {
				org.value = '';
			}
			else {
				const clone = org.cloneNode(false);
				elements.push({org:org, clone:clone});
				org.parentNode.replaceChild(clone, org);
				form.appendChild(org);
			}
		}
	}

	if (elements.length) {
		form.reset();
		for (let i = 0; i < elements.length; i++) {
			elements[i].clone.parentNode.replaceChild(elements[i].org, elements[i].clone);
			elements[i] = null;
		}
	}
}

function parseModerateResponse (response) {
	let re;

	re = /<font[^>]*><b>(.*?)(?:<br\s*\/?>)+.*<a[^>]*>戻る<\/a>/i.exec(response);
	if (re) {
		return {
			error: re[1]
				.replace(/<br\b[^>]*>/ig, '\n')
				.replace(/<[^>]+>/g, ' ')
				.replace(/[\s\t\n]+/g, ' ')
		};
	}

	re = /<body[^>]*>登録しました/i.exec(response);
	if (re) {
		return {
			registered: true
		};
	}

	re = /<body[^>]*>(.*)$/i.exec(response);
	if (re) {
		re = re[1].replace(/<\/body>.*$/i, '');
	}
	else {
		re = response.replace(/<!DOCTYPE[^>]+>\r?\n?/i, '');
	}

	return {error: re || 'なんか変です'};
}

function parsePostResponse (response, baseUrl) {
	let re;

	re = /<font[^>]*><b>(.*?)(?:<br\s*\/?>)+<a[^>]*>リロード<\/a>/i.exec(response);
	if (re) {
		return {
			error: re[1]
				.replace(/<br\b[^>]*>/ig, '\n')
				.replace(/<[^>]+>/g, ' ')
				.replace(/[\s\t\n]+/g, ' ')
		};
	}

	let refreshURL = '';
	re = /<meta\s+([^>]+)>/i.exec(response);
	if (re && /http-equiv="refresh"/i.test(re[1])) {
		re = /content="\d+;url=([^"]+)"/i.exec(re[1]);
		if (re) {
			refreshURL = resolveRelativePath(re[1], baseUrl);
		}
	}
	if (refreshURL != '') {
		return {redirect: refreshURL};
	}

	re = /<body[^>]*>(.*)$/i.exec(response);
	if (re) {
		re = re[1].replace(/<\/body>.*$/i, '');
	}
	else {
		re = response.replace(/<!DOCTYPE[^>]+>\r?\n?/i, '');
	}

	return {error: re || 'なんか変です'};
}

function registerReleaseFormLock () {
	setTimeout(() => {
		$qs('fieldset', 'postform').disabled = false;
	}, POSTFORM_LOCK_RELEASE_DELAY);
}

/*
 * <<<1 functions for reloading
 */

function reloadBase (type, opts) { /*returns promise*/
	timingLogger.startTag('reloadBase');

	function detectionTest (doc) {
		// for mark detection test
		$qsa('blockquote:nth-child(-n+4)', doc).forEach((node, i) => {
			switch (i) {
			case 0:
				// marked
				node.insertAdjacentHTML(
					'afterbegin',
					'<font color="#ff0000">marked post</font><br>');
				break;
			case 1:
				// marked with bracked
				node.insertAdjacentHTML(
					'afterbegin',
					'[<font color="#ff0000">marked post</font>]<br>');
				break;
			case 2:
				// deleted with mark
				node.insertAdjacentHTML(
					'afterbegin',
					'<font color="#ff0000">marked post</font><br>');
				for (let n = node; n && n.nodeName != 'TABLE'; n = n.parentNode);
				n && n.classList.add('deleted');
				break;
			case 3:
				// deleted with mark
				node.insertAdjacentHTML(
					'afterbegin',
					'[<font color="#ff0000">marked post</font>]<br>');
				for (let n = node; n && n.nodeName != 'TABLE'; n = n.parentNode);
				n && n.classList.add('deleted');
				break;
			}
		});
		// for expiration warning test
		$qsa('small + blockquote', doc).forEach((node, i) => {
			node.insertAdjacentHTML(
				'afterend',
				'<font color="#f00000"><b>このスレは古いので、もうすぐ消えます。</b></font><br>'
			);
		});
	}

	opts || (opts = {});
	reloadStatus.lastReloadType = 'full';
	reloadStatus.lastReceivedBytes = reloadStatus.lastReceivedCompressedBytes = 0;

	return new Promise((resolve, reject) => {
		const now = Date.now();
		const method = (opts.method || 'get').toUpperCase();

		let xhr = transport.create(type);
		xhr.open(method, location.href);
		xhr.overrideMimeType(`text/html;charset=${FUTABA_CHARSET}`);
		DEBUG_IGNORE_LAST_MODIFIED && (siteInfo.lastModified = 0);
		xhr.setRequestHeader('If-Modified-Since', siteInfo.lastModified || FALLBACK_LAST_MODIFIED);

		xhr.onprogress = e => {
			reloadStatus.lastReceivedBytes += e.loaded;
			reloadStatus.lastReceivedCompressedBytes += e.loaded;
		};

		xhr.onload = e => {
			timingLogger.endTag();

			const lm = xhr.getResponseHeader('Last-Modified');
			if (lm) {
				siteInfo.lastModified = lm;
			}

			if (devMode) {
				reloadStatus.lastReceivedText = xhr.responseText;
			}

			let headerSize = xhr.getAllResponseHeaders().length;
			if (location.protocol == 'https:') {
				headerSize = Math.ceil(headerSize * 0.33);	// this factor is heuristic.
			}
			reloadStatus.lastReceivedBytes += headerSize;
			reloadStatus.lastReceivedCompressedBytes += headerSize;

			let doc;

			if (method == 'HEAD') {
				reloadStatus.totalReceivedBytes += reloadStatus.lastReceivedBytes;
				reloadStatus.totalReceivedCompressedBytes += reloadStatus.lastReceivedCompressedBytes;
			}
			else if (method != 'HEAD' && xhr.status == 200) {
				if (/gzip/.test(xhr.getResponseHeader('Content-Encoding'))) {
					const contentLength = xhr.getResponseHeader('Content-Length');
					if (contentLength) {
						reloadStatus.lastReceivedCompressedBytes = parseInt(contentLength, 10) + headerSize;
					}
				}

				reloadStatus.totalReceivedBytes += reloadStatus.lastReceivedBytes;
				reloadStatus.totalReceivedCompressedBytes += reloadStatus.lastReceivedCompressedBytes;

				/*
				console.log([
					'*** full reload ***',
					`       header size: ${headerSize}`,
					`    content length: ${xhr.getResponseHeader('Content-Length')} (${getReadableSize(xhr.getResponseHeader('Content-Length') - 0)})`,
					` lastReceivedBytes: ${reloadStatus.lastReceivedBytes} (${getReadableSize(reloadStatus.lastReceivedBytes)})`,
					`totalReceivedBytes: ${reloadStatus.totalReceivedBytes} (${getReadableSize(reloadStatus.totalReceivedBytes)})`,
					`----`,
					` lastReceivedCompressedBytes: ${reloadStatus.lastReceivedCompressedBytes} (${getReadableSize(reloadStatus.lastReceivedCompressedBytes)})`,
					`totalReceivedCompressedBytes: ${reloadStatus.totalReceivedCompressedBytes} (${getReadableSize(reloadStatus.totalReceivedCompressedBytes)})`
				].join('\n'));
				*/

				timingLogger.startTag('parsing html');
				doc = xhr.responseText;

				doc = doc.replace(
					/>([^<]+)</g,
					($0, content) => {
						content = resolveCharacterReference(content)
							.replace(/&/g, '&amp;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;');
						return `>${content}<`;
					});
				doc = doc.replace(
					/(<a\s+href="mailto:)([^"]+)("[^>]*>)/gi,
					($0, head, content, bottom) => {
						content = resolveCharacterReference(content)
							.replace(/&/g, '&amp;')
							.replace(/"/g, '&quot;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;');
						return `${head}${content}${bottom}`;
					});

				doc = getDOMFromString(doc);
				timingLogger.endTag();

				if (!doc) {
					reject(new Error('読み込んだ html からの DOM ツリー構築に失敗しました。'));
					return;
				}
			}

			//doc && detectionTest();

			resolve({
				doc: doc,
				now: now,
				status: xhr.status
			});
		};

		xhr.onerror = e => {
			timingLogger.endTag();

			reject(new Error(
				'ネットワークエラーにより内容を取得できません。' +
				`\n(${xhr.status})`));
		};

		xhr.onloadend = () => {
			xhr = null;
		};

		xhr.setRequestHeader('X-Requested-With', `${APP_NAME}/${version}`);
		xhr.send();
	});
}

function reloadBaseViaAPI (type, opts) { /*returns promise*/
	timingLogger.startTag('reloadBaseViaAPI');

	opts || (opts = {});
	reloadStatus.lastReloadType = 'delta';
	reloadStatus.lastReceivedBytes = reloadStatus.lastReceivedCompressedBytes = 0;

	return new Promise((resolve, reject) => {
		const now = Date.now();
		const url = [
			`${location.protocol}//${location.host}/${siteInfo.board}/futaba.php`,
			`?mode=json`,
			`&res=${siteInfo.resno}`,
			`&start=${getLastReplyNumber() + 1}`
		].join('');

		let xhr = transport.create(type);
		xhr.open('GET', url);
		xhr.overrideMimeType(`text/html;charset=UTF-8`);
		xhr.setRequestHeader('If-Modified-Since', FALLBACK_LAST_MODIFIED);

		xhr.onprogress = e => {
			reloadStatus.lastReceivedBytes += e.loaded;
			reloadStatus.lastReceivedCompressedBytes += e.loaded;
		};

		xhr.onload = e => {
			timingLogger.endTag();

			if (devMode) {
				reloadStatus.lastReceivedText = xhr.responseText;
			}

			let headerSize = xhr.getAllResponseHeaders().length;
			if (location.protocol == 'https:') {
				headerSize = Math.ceil(headerSize * 0.33);	// this factor is heuristic.
			}
			reloadStatus.lastReceivedBytes += headerSize;
			reloadStatus.lastReceivedCompressedBytes += headerSize;

			let doc;

			if (xhr.status == 200) {
				if (/gzip/.test(xhr.getResponseHeader('Content-Encoding'))) {
					const contentLength = xhr.getResponseHeader('Content-Length');
					if (contentLength) {
						reloadStatus.lastReceivedCompressedBytes = parseInt(contentLength, 10) + headerSize;
					}
					else {
						let factor;
						[
							[  512, 0.95],
							[ 1024, 0.65],
							[ 2048, 0.50],
							[ 4096, 0.40],
							[ 8192, 0.30],
							[16384, 0.20],
							[32768, 0.18],
							[65536, 0.16],
							[0x7fffffff, 0.14]
						].some(set => {
							if (reloadStatus.lastReceivedBytes < set[0]) {
								factor = set[1];
								return true;
							}
						});

						reloadStatus.lastReceivedCompressedBytes = Math.ceil(reloadStatus.lastReceivedBytes * factor) + headerSize;
					}
				}

				reloadStatus.totalReceivedBytes += reloadStatus.lastReceivedBytes;
				reloadStatus.totalReceivedCompressedBytes += reloadStatus.lastReceivedCompressedBytes;

				/*
				console.log([
					'*** delta reload ***',
					`       header size: ${headerSize}`,
					` lastReceivedBytes: ${reloadStatus.lastReceivedBytes} (${getReadableSize(reloadStatus.lastReceivedBytes)})`,
					`totalReceivedBytes: ${reloadStatus.totalReceivedBytes} (${getReadableSize(reloadStatus.totalReceivedBytes)})`,
					`----`,
					` lastReceivedCompressedBytes: ${reloadStatus.lastReceivedCompressedBytes} (${getReadableSize(reloadStatus.lastReceivedCompressedBytes)})`,
					`totalReceivedCompressedBytes: ${reloadStatus.totalReceivedCompressedBytes} (${getReadableSize(reloadStatus.totalReceivedCompressedBytes)})`
				].join('\n'));
				*/

				timingLogger.startTag('parsing json');
				try {
					doc = xhr.responseText;

					doc = JSON.parse(doc, (key, value) => {
						if (typeof value != 'string') return value;

						const value2 = value.replace(
							/(^|>)([^<]+)($|<)/g,
							($0, head, content, bottom) => {
								content = resolveCharacterReference(content)
									.replace(/&/g, '&amp;')
									.replace(/</g, '&lt;')
									.replace(/>/g, '&gt;');
								return `${head}${content}${bottom}`;
							}
						);
						/*
						if (value2 != value) {
							console.log([
								'*** replace in json ***',
								` value: "${value}"`,
								`value2: "${value2}"`,
							].join('\n'));
							value = value2;
						}
						return value;
						*/
						return value2;
					});
				}
				catch (e) {
					doc = undefined;
				}
				timingLogger.endTag();

				if (!doc) {
					timingLogger.endTag(); // parsing json
					reject(new Error('読み込んだ JSON の解析に失敗しました。'));
					return;
				}
			}

			resolve({
				doc: doc,
				now: now,
				status: xhr.status
			});
		};

		xhr.onerror = e => {
			timingLogger.endTag();

			reject(new Error(
				'ネットワークエラーにより内容を取得できません。' +
				`\n(${xhr.status})`));
		};

		xhr.onloadend = () => {
			xhr = null;
		};

		xhr.setRequestHeader('X-Requested-With', `${APP_NAME}/${version}`);
		xhr.send();
	});
}

function reloadCatalogBase (type, query) { /*returns promise*/
	timingLogger.startTag('reloadCatalogBase');

	return new Promise((resolve, reject) => {
		const now = Date.now();
		const url = `${location.protocol}//${location.host}/${siteInfo.board}/futaba.php?mode=cat${query}`

		let xhr = transport.create(type);
		xhr.open('GET', url);
		xhr.overrideMimeType(`text/html;charset=${FUTABA_CHARSET}`);

		xhr.onload = e => {
			timingLogger.endTag();

			timingLogger.startTag('parsing html');
			let doc;
			if (xhr.status == 200) {
				doc = xhr.responseText;

				const re = /<script[^>]+>var\s+ret\s*=JSON\.parse\('([^<]+)'\)/.exec(doc);
				if (re) {
					re[1] = re[1]
						.replace(/\\u([0-9a-f]{4})/ig, ($0, $1) => String.fromCharCode(parseInt($1, 16)))
						.replace(/\\([^"\\\/bfnrt])/g, '$1')
						.replace(/\\","cr":/g, '","cr":');	// **REALLY REALLY BAD**

					let data;
					try {
						data = JSON.parse(re[1]);
					}
					catch (err) {
						console.error(err.message + '\n' + err.stack);
						if (/in JSON at position (\d+)/.test(err.message)) {
							console.error(`error string: "${re[1].substr(RegExp.$1 - 8, 16)}"`);
						}
						data = {res: []};
					}

					const buffer = [];
					for (let i = 0; i < data.res.length; i++) {
						const item = data.res[i];

						if ('src' in item) {
							buffer.push(`<td><a href='res/${item.no}.htm' target='_blank'><img src='${item.src.replace(/\\\//g, '\/')}' border=0 width=${item.w} height=${item.h} alt=""></a><br><small>${item.com.replace(/\\\//g, '\/')}</small><br><font size=2>${item.cr}</font></td>\n`);
						}
						else {
							buffer.push(`<td><a href='res/${item.no}.htm' target='_blank'><small>${item.com.replace(/\\\//g, '\/')}</small></a><br><font size=2>${item.cr}</font></td>`);
						}

						if (i > 0 && (i % 15) == 14) {
							buffer.push('</tr>\n<tr>');
						}
					}
					buffer.unshift("<table border=1 align=center id='cattable'><tr>");
					buffer.push('</tr>\n</table>');
					doc = doc.replace(/(<div\s+id=["']?cattable["']?[^>]*>)(<\/div>)/, buffer.join(''));
				}

				doc = getDOMFromString(doc);
				if (!doc) {
					timingLogger.endTag(); // parsing html
					reject(new Error('読み込んだ html からの DOM ツリー構築に失敗しました。'));
					return;
				}
			}
			timingLogger.endTag();

			resolve({
				doc: doc,
				now: now,
				status: xhr.status
			});
		};

		xhr.onerror = e => {
			timingLogger.endTag();

			reject(new Error(
				'ネットワークエラーにより内容を取得できません。' +
				`\n(${xhr.status})`));
		};

		xhr.onloadend = () => {
			xhr = null;
		};

		xhr.setRequestHeader('X-Requested-With', `${APP_NAME}/${version}`);
		xhr.send();
	});
}

function modifyPage () {
	const PROMISE_KEY = 'modify';
	globalPromises[PROMISE_KEY] = (globalPromises[PROMISE_KEY] || Promise.resolve())
		.then(() => Promise.all([
			adjustReplyWidth(),
			extractTweets(),
			//replaceSiokaraThumbnails(),
			extractNico2(),
			completeDefectiveLinks()
		]))
		.then(() => {
			if (resourceSaver.threadSaverRunning) {
				return resourceSaver
					.thread()
					.then(saver => saver.push(postStats.lastStats));
			}
		});
}

async function adjustReplyWidth () {
	let nodes;
	while ((nodes = $qsa('.reply-wrap .reply-image:not(.width-adjusted)')).length) {
		const maxTextWidth = Math.floor($qs('.text').offsetWidth * 0.9);

		for (let i = 0; i < nodes.length && i < EXTRACT_UNIT; i++) {
			const replyImage = nodes[i];
			const replyWrap = replyImage.closest('.reply-wrap');
			const heading = $qs('.image_true', replyWrap);
			const comment = $qs('.comment', replyWrap);
			const replyImageWidth = replyImage.offsetWidth;

			replyImage.classList.add('hide');
			heading.classList.add('hide');
			const normalWidth = comment.offsetWidth;
			replyImage.classList.remove('hide');
			heading.classList.remove('hide');

			const minWidth = Math.min(normalWidth + replyImageWidth + 8, maxTextWidth);
			comment.style.minWidth = `${minWidth}px`;
			replyImage.classList.add('width-adjusted');
		}

		await delay(Math.floor(Math.random() * 1000 + 1000));
	}
}

async function extractTweets () {
	let tweets;
	let lastHtml;
	while ((tweets = $qsa('.link-twitter')).length) {
		for (let i = 0; i < tweets.length && i < EXTRACT_UNIT; i++) {
			const id = tweets[i].getAttribute('data-tweet-id');
			if (id) {
				await backend.send('get-tweet', {url: tweets[i].href, id: id}).then(data => {
					if (data) {
						tweets[i].insertAdjacentHTML(
							'afterend',
							data.html.replace(/<script\b[^>]*>.*?<\/script>/i, ''));
						lastHtml = data.html;
					}
				});
			}
			tweets[i].classList.remove('link-twitter');
		}

		if (lastHtml) {
			await new Promise(resolve => {
				let scriptSource = '';
				if (!$('twitter-widget-script')) {
					let re = /<script\b[^>]*src="([^"]+)"/.exec(lastHtml);
					if (re) {
						scriptSource = re[1];
					}
				}

				const scriptNode = document.head.appendChild(document.createElement('script'));
				scriptNode.type = 'text/javascript';
				scriptNode.charset = 'UTF-8';
				if (scriptSource != '') {
					scriptNode.id = 'twitter-widget-script';
					scriptNode.src = scriptSource;
					scriptNode.onload = resolve;
				}
				else {
					scriptNode.id = 'tweet-loader-' + Math.floor(Math.random() * 0x80000000);
					scriptNode.src = 'data:text/javascript,' +
						'window.twttr&&window.twttr.widgets.load();' +
						`document.head.removeChild(document.getElementById("${scriptNode.id}"));`;
					scriptNode.onload = resolve;
				}
			});
		}

		await delay(Math.floor(Math.random() * 1000 + 1000));
	}
}

/*
async function replaceSiokaraThumbnails () {
	let files;
	while ((files = $qsa('.link-siokara.incomplete-thumbnail')).length) {
		for (let i = 0; i < files.length && i < EXTRACT_UNIT; i++) {
			const thumbHref = files[i].getAttribute('data-thumbnail-href');
			if (thumbHref) {
				await backend.send('load-siokara-thumbnail', {url: thumbHref}).then(data => {
					if (!data && /\.(webm|mp4|mp3|ogg)$/.test($qs('a', files[i]).href)) {
						data = chrome.extension.getURL('images/siokara-video.png');
					}
					if (data) {
						const thumbnailImage = $qs('img', files[i]);
						if (thumbnailImage) {
							thumbnailImage.src = data;
						}
					}
				});
			}
			files[i].classList.remove('incomplete-thumbnail');
		}

		await delay(Math.floor(Math.random() * 1000 + 1000));
	}
}
*/

async function extractNico2 () {
	const KEY_NAME = 'data-nico2-key';
	let files;
	while ((files = $qsa(`.inline-video.nico2[${KEY_NAME}]`)).length) {
		for (let i = 0; i < files.length && i < EXTRACT_UNIT; i++) {
			const key = files[i].getAttribute(KEY_NAME);
			const scriptNode = files[i].parentNode.insertBefore(document.createElement('script'), files[i]);
			scriptNode.type = 'application/javascript';
			scriptNode.src = `https://embed.nicovideo.jp/watch/${key}/script?w=640&h=360`;
			scriptNode.onload = e => {
				scriptNode.parentNode.removeChild(scriptNode);
			};
			files[i].removeAttribute(KEY_NAME);
			files[i].parentNode.removeChild(files[i]);
		}

		await delay(Math.floor(Math.random() * 1000 + 1000));
	}
}

async function completeDefectiveLinks () {

	function completeUpLink (node) {
		const [base] = /^fu?\d+/.exec(node.getAttribute('data-basename'));
		const board = /^fu/.test(base) ? 'up2' : 'up';
		return fetch(`//appsweets.net/thumbnail/${board}/${base}s.js`)
		.then(response => response.json())
		.then(data => {
			if (!data) {
				throw new Error('サムネイルサーバから正しいデータが返されませんでした');
			}

			// prevent from infinite loop
			if (!/^fu?\d+\..+$/.test(data.name)) {
				throw new Error(`補完結果が不正です: "${data.name}"`);
			}

			// set up internal partial XML
			const xml = createFutabaXML(pageModes[0].mode);
			const comment = xml.documentElement.appendChild(xml.createElement('comment'));
			const parent = node.closest('q') ?
				comment.appendChild(xml.createElement('q')) :
				comment;
			parent.appendChild(xml.createTextNode(data.name));
			linkifier.linkify(parent);
			xsltProcessor.setParameter(null, 'render_mode', 'comment');

			// XSL transform
			const fragment = fixFragment(xsltProcessor.transformToFragment(xml, document));

			// apply transform result
			if (parent == comment) {
				/*
				 * fragment:
				 *
				 * #fragment
				 *   <a class="link-up">...</a>
				 *   <small> - [保存する]</small>
				 *   <br>
				 *   <a class="link-up"><img src="#"></a>
				 */

				// we can add the fragment itself
				node.parentNode.insertBefore(fragment, node);
			}
			else {
				/*
				 * fragment:
				 *
				 * #fragment
				 *   <q>
				 *     <a class="link-up">...</a>
				 *   </q>
				 */

				// we have to pick the anchor up
				node.parentNode.insertBefore($qs('a', fragment), node);
			}
			node.parentNode.removeChild(node);
		})
		.catch(err => {
			console.error(err.stack);
			const span = node.appendChild(document.createElement('span'));
			span.className = 'link-completion-notice';
			span.textContent = '(補完失敗)';
			span.title = err.message;
		})
		.finally(() => {
			node = null;
		});
	}

	function completeSiokaraLink (node, data) {
		if (!data || !/^s[a-z]\d+\..+$/.test(data.base)) {
			const span = node.appendChild(document.createElement('span'));
			span.className = 'link-completion-notice';
			span.textContent = '(補完失敗)';
			span.title = 'バッググラウンドから正しいデータが返されませんでした';
			return;
		}

		// set up internal partial XML
		const xml = createFutabaXML(pageModes[0].mode);
		const comment = xml.documentElement.appendChild(xml.createElement('comment'));
		comment.appendChild(xml.createTextNode(data.base));
		linkifier.linkify(comment);
		xsltProcessor.setParameter(null, 'render_mode', 'comment');

		// XSL transform
		const fragment = fixFragment(xsltProcessor.transformToFragment(xml, document));
		const newNode = $qs('.link-siokara', fragment);
		if (!newNode) {
			const span = node.appendChild(document.createElement('span'));
			span.className = 'link-completion-notice';
			span.textContent = '(補完失敗)';
			span.title = 'XSLT 再変換の結果がフラグメントを含んでいません';
			return;
		}

		// some adjustments
		if (/\.(webm|mp4|mp3|ogg)$/.test(data.url)) {
			data.thumbnail = chrome.extension.getURL('images/siokara-video.png');
		}
		$qsa('img', newNode).forEach(img => {
			img.src = data.thumbnail;
		});
		newNode.classList.remove('incomplete');

		// apply transform result
		node.parentNode.insertBefore(newNode, node);
		node.parentNode.removeChild(node);
	}

	let files;
	while ((files = $qsa('.link-up.incomplete, .link-siokara.incomplete')).length) {
		for (let i = 0; i < files.length && i < EXTRACT_UNIT; i++) {
			const id = files[i].getAttribute('data-basename');
			if (/^fu?\d+/.test(id)) {
				await completeUpLink(files[i]);
			}
			else if (/^s[a-z]\d+/.test(id)) {
				await backend.send('complete', {url:files[i].href, id:id}).then(data => {
					completeSiokaraLink(files[i], data);
				});
			}
			files[i].classList.remove('incomplete');
		}

		await delay(Math.floor(Math.random() * 1000 + 1000));
	}
}

function detectNoticeModification (notice, noticeNew) {
	return modules('difflib').then(module => {
		const {difflib} = module;
		const list = $qs('#panel-content-notice ul');
		if (!list) return;

		const opcodes = new difflib.SequenceMatcher(
			difflib.stringAsLines(notice),
			difflib.stringAsLines(noticeNew)).get_opcodes();
		const baseLines = notice
			.replace(/__akahukuplus_viewers_count__/g, $('viewers').textContent)
			.split('\n');
		const newLines = noticeNew
			.replace(/__akahukuplus_viewers_count__/g, $('viewers').textContent)
			.split('\n');
		const add = (rows, index1, index2, lines, className) => {
			let markup = undefined;
			if (typeof index1 == 'number' && index1 >= 0 && index1 < lines.length) {
				markup = lines[index1];
			}
			else if (typeof index2 == 'number' && index2 >= 0 && index2 < lines.length) {
				markup = lines[index2];
			}
			if (markup != undefined) {
				rows.push({
					className: className,
					markup: markup
				});
			}
		};
		const rows = [];

		for (let idx = 0; idx < opcodes.length; idx++) {
			let [change, baseStart, baseEnd, newStart, newEnd] = opcodes[idx];

			const rowCount = Math.max(baseEnd - baseStart, newEnd - newStart);
			const topRows = [];
			const botRows = [];

			for (let i = 0; i < rowCount; i++) {
				switch (change) {
				case 'insert':
					add(rows, null, newStart++, newLines, change);
					break;

				case 'replace':
					if (baseStart < baseEnd) {
						add(topRows, baseStart++, null, baseLines, 'delete');
					}
					if (newStart < newEnd) {
						add(botRows, null, newStart++, newLines, 'insert');
					}
					break;

				case 'delete':
					add(rows, baseStart++, null, baseLines, change);
					break;

				default:
					// equal
					add(rows, baseStart++, newStart++, baseLines, change);
					break;
				}
			}

			if (change == 'replace') {
				rows.push.apply(rows, topRows);
				rows.push.apply(rows, botRows);
			}
		}

		empty(list);
		rows.forEach(row => {
			const li = list.appendChild(document.createElement('li'));
			li.className = row.className;
			li.innerHTML = row.markup;
			if (row.className != 'equal') {
				console.log(`${row.className}: "${row.markup}"`);
			}
		});
	});
}

/*
 * <<<1 functions for reload feature in reply mode
 */

function setReloaderStatus (content, persistent) {
	const fetchStatus = $('fetch-status');
	if (!fetchStatus) return;

	if (content != undefined) {
		fetchStatus.classList.remove('hide');
		$t(fetchStatus, content);
		if (!persistent) {
			setTimeout(setReloaderStatus, RELOAD_LOCK_RELEASE_DELAY);
		}
	}
	else {
		$t(fetchStatus, '');
		fetchStatus.classList.add('hide');
	}
}

// called from reloadReplies()
function updateTopic (xml, container) {

	function updateMarkedTopic () {
		let result = false;
		const marks = $qsa('topic > mark', xml);
		for (let i = 0, goal = marks.length; i < goal; i++) {
			const number = $qs('number', marks[i].parentNode).textContent;

			const node = $qs(`.topic-wrap[data-number="${number}"]`, container);
			if (!node || $qs('.mark', node)) continue;

			const comment = $qs('.comment', node);
			if (!comment) continue;

			const isBracket = marks[i].getAttribute('bracket') == 'true';
			comment.insertBefore(document.createElement('br'), comment.firstChild);
			isBracket && comment.insertBefore(document.createTextNode(']'), comment.firstChild);
			const m = comment.insertBefore(document.createElement('span'), comment.firstChild);
			m.className = 'mark';
			m.textContent = marks[i].textContent;
			isBracket && comment.insertBefore(document.createTextNode('['), comment.firstChild);

			result = true;
		}
		return result;
	}

	function updateIdentifiedTopic () {
		let result = false;
		const ids = $qsa('topic > user_id', xml);
		for (let i = 0, goal = ids.length; i < goal; i++) {
			const number = $qs('number', ids[i].parentNode).textContent;

			const node = $qs(`.topic-wrap[data-number="${number}"]`, container);
			if (!node || $qs('.user-id', node)) continue;

			const postno = $qs('.postno', node);
			if (!postno) continue;

			const id = postno.parentNode.insertBefore((document.createElement('span')), postno);
			id.className = 'user-id';
			id.textContent = `ID:${ids[i].textContent}`;
			id.setAttribute('data-id', ids[i].textContent);
			postno.parentNode.insertBefore(document.createElement('span'), postno);

			const sep = postno.parentNode.insertBefore(document.createElement('span'), postno);
			sep.className = 'sep';
			sep.textContent = '|';

			result = true;
		}
		return result;
	}

	updateMarkedTopic();
	updateIdentifiedTopic();
}

// called from processRemainingReplies()
function updateReplies (xml, container) {

	function updateReplyAssets (selector, handler) {
		timingLogger.startTag(`updateReplyAssets(${selector})`);
		const assets = $qsa(selector, xml);
		const replies = container.children;
		const hiddenReplies = container.getAttribute('hidden') - 0;
		let result = 0;
		for (const asset of assets) {
			// retrieve offset
			const offset = $qs('offset', asset.parentNode).textContent - hiddenReplies - 1;
			if (offset < 0 || offset >= container.childElementCount) {
				continue;
			}

			// retrieve current reply
			const number = $qs('number', asset.parentNode).textContent;
			const node = $qs(`[data-number="${number}"]`, replies[offset]);
			if (!node) {
				console.error([
					`internal number unmatch:`,
					`number: ${number}`,
					`actual number: ${$qs('[data-number]').getAttribute('data-number')}`
				].join('\n'));
				continue;
			}

			const processed = handler(asset, node);
			processed && result++;
		}
		timingLogger.endTag(`/ ${result} items`);
		return result;
	}

	function updateMarkedReplies () {
		return updateReplyAssets('reply > mark', (asset, node) => {
			// Do nothing if already deleted-mark flagged
			// TODO: We may have to distinguish remote host display, deletion by commenter,
			// deletion by poster, and なー.
			if (node.classList.contains('deleted')) return;
			node.classList.add('deleted');

			// retrieve current comment
			const comment = $qs('.comment', node);
			if (!comment) {
				console.error([
					`comment not found:`,
					`${node.outerHTML}`
				].join('\n'));
				return;
			}

			// insert mark
			const isBracket = asset.getAttribute('bracket') == 'true';
			comment.insertBefore(document.createElement('br'), comment.firstChild);
			isBracket && comment.insertBefore(document.createTextNode(']'), comment.firstChild);
			const m = comment.insertBefore(document.createElement('span'), comment.firstChild);
			m.className = 'mark';
			m.textContent = asset.textContent;
			isBracket && comment.insertBefore(document.createTextNode('['), comment.firstChild);

			return true;
		});
	}

	function updateIdentifiedReplies () {
		// In ID表示 mode, ID is displayed in all comments,
		// So we must not do anything.
		if (siteInfo.idDisplay) {
			return 0;
		}

		return updateReplyAssets('reply > user_id', (asset, node) => {
			// Do nothing if already user id exists
			if ($qs('.user-id', node)) return;

			// insert id
			const div = node.appendChild(document.createElement('div'));
			div.appendChild(document.createTextNode('──'));
			const span = div.appendChild(document.createElement('span'));
			div.className = span.className = 'user-id';
			span.textContent = 'ID:' + asset.textContent;
			span.setAttribute('data-id', asset.textContent);
			div.appendChild(document.createElement('span'));

			return true;
		});
	}

	updateMarkedReplies();
	updateIdentifiedReplies();
}

// called from processRemainingReplies(), reloadRepliesViaAPI()
function updateSodanePosts (stat) {
	timingLogger.startTag(`updateSodanePosts`);
	for (const {number, value, oldValue} of stat.delta.sodane) {
		const sodaneNode = $(`sodane_${number}`) || $qs([
			`article .topic-wrap[data-number="${number}"] .sodane`,
			`article .topic-wrap[data-number="${number}"] .sodane-null`,
			`article .reply-wrap > [data-number="${number}"] .sodane`,
			`article .reply-wrap > [data-number="${number}"] .sodane-null`
		].join(','));
		if (!sodaneNode) {
			continue;
		}

		if (!sodaneNode.id) {
			sodaneNode.id = `sodane_${number}`;
		}

		const re = /^\d+$/.exec(sodaneNode.textContent);

		if (re && re[0] - 0 == value) {
			continue;
		}

		if (value) {
			$t(sodaneNode, value);
			sodaneNode.classList.remove('sodane-null');
			sodaneNode.classList.add('sodane');
		}
		else {
			$t(sodaneNode, '＋');
			sodaneNode.classList.add('sodane-null');
			sodaneNode.classList.remove('sodane');
		}
	}
	timingLogger.endTag();
}

// called from processRemainingReplies(), reloadRepliesViaAPI()
function updateIdFrequency (stat) {
	timingLogger.startTag(`updateIdFrequency`);
	for (const [id, idData] of stat.idData) {
		// Single ID must not be counted
		if (idData.length == 1) continue;

		const selector = [
			`article .topic-wrap span.user-id[data-id="${id}"]`,
			`article .reply-wrap span.user-id[data-id="${id}"]`
		].join(',');

		// Important optimization: If the total number of IDs has not changed,
		// It is not necessary to update entire posts with current ID
		const re = /\d+\/(\d+)/.exec($qs(selector).nextSibling.textContent);
		if (re && re[1] - 0 == idData.length) continue;

		// Count up all posts with the same ID...
		const posts = $qsa(selector);
		for (let i = 0, index = 1, goal = posts.length; i < goal; i++, index++) {
			$t(posts[i].nextSibling, `(${index}/${idData.length})`);
		}
	}
	timingLogger.endTag();
}

function getReplyContainer (index) {
	index || (index = 0);
	return $qs(`article:nth-of-type(${index + 1}) .replies`);
}

function getRepliesCount (index) {
	index || (index = 0);
	return $qsa(`article:nth-of-type(${index + 1}) .reply-wrap`).length;
}

function getRule (container) {
	container || (container = getReplyContainer());
	if (!container) return;
	return $qs('.rule', container);
}

function getLastReplyNumber (index) {
	index || (index = 0);
	return ($qs([
		`article:nth-of-type(${index + 1})`,
		'.reply-wrap:last-child',
		'[data-number]'
	].join(' ')) || $qs([
		`article:nth-of-type(${index + 1})`,
		'.topic-wrap'
	].join(' '))).getAttribute('data-number') - 0;
}

function createRule (container) {
	let rule = getRule(container);
	if (!rule) {
		rule = container.appendChild(document.createElement('div'));
		rule.className = 'rule';
	}
	return rule;
}

function removeRule (container) {
	container || (container = getReplyContainer());
	if (!container) return;
	const rule = $qs('.rule', container);
	if (!rule) return;
	rule.parentNode.removeChild(rule);
}

function stripTextNodes (container) {
	/*
	 * In the replies container, the index of node may be used as
	 * an offset of reply. Therefore, we have to remove unnecessary
	 * text nodes.
	 */
	container || (container = getReplyContainer());
	if (!container) return;

	const result = document.evaluate(
		'./text()', container, null,
		window.XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
		null);
	if (!result) return;

	for (let i = 0, goal = result.snapshotLength; i < goal; i++) {
		const node = result.snapshotItem(i);
		node.parentNode.removeChild(node);
	}
}

function processRemainingReplies (opts, context, lowBoundNumber, callback) {
	let maxReplies;

	opts || (opts = {});

	// 'read more' function in reply mode, process whole new replies
	if (typeof lowBoundNumber == 'number') {
		maxReplies = 0x7fffffff;
	}
	// other: process per chunk
	else {
		lowBoundNumber = -1;
		maxReplies = REST_REPLIES_PROCESS_COUNT;
	}

	timingLogger.reset().startTag(`proccessing remaining replies`, `lowBoundNumber:${lowBoundNumber}`);
	xmlGenerator.remainingReplies(
		context, maxReplies, lowBoundNumber,
		(xml, index, count, count2) => {
			if (devMode && ($qs('[data-href="#toggle-dump-xml"]') || {}).checked) {
				console.log(serializeXML(xml));
			}

			const container = getReplyContainer(index);
			if (!container) return;

			if (lowBoundNumber < 0) {
				postStats.updatePostformView({
					count: {
						total: count,
						mark: 0,
						id: 0
					},
					delta: null
				});
				xsltProcessor.setParameter(null, 'render_mode', 'replies');
			}
			else {
				updateReplies(xml, container);
				xsltProcessor.setParameter(null, 'low_bound_number', lowBoundNumber);
				xsltProcessor.setParameter(null, 'render_mode', 'replies_diff');
			}

			try {
				const f = fixFragment(xsltProcessor.transformToFragment(xml, document));
				if ($qs('.reply-wrap', f)) {
					if (lowBoundNumber >= 0) {
						createRule(container);
					}

					extractDisableOutputEscapingTags(container, f);
					stripTextNodes(container);
				}
			}
			catch (e) {
				console.error(`${APP_NAME}: processRemainingReplies: exception(1), ${e.stack}`);
			}
		},
		() => {
			timingLogger.startTag('statistics update');

			// reload on reply mode
			if (pageModes[0].mode == 'reply' && lowBoundNumber >= 0) {
				const stats = postStats.done();

				if (stats.delta.total || stats.delta.mark || stats.delta.id) {
					if ($qs('#panel-aside-wrap.run #panel-content-mark:not(.hide)')) {
						postStats.updatePanelView();
					}
					titleIndicator.startBlink();
					postStats.updatePostformView();
					callback && callback(stats);
					scrollToNewReplies(opts.scrollBehavior, () => {
						updateSodanePosts(stats);
						updateIdFrequency(stats);
						modifyPage();
					});
				}
				else {
					callback && callback(stats);
				}
			}

			// first load on summary or reply mode
			else {
				const stats = postStats.done(true);

				if ($qs('#panel-aside-wrap.run #panel-content-mark:not(.hide)')) {
					postStats.updatePanelView();
				}

				postStats.updatePostformView();
				callback && callback(stats);
				updateSodanePosts(stats);
				updateIdFrequency(stats);
				modifyPage();
			}

			timingLogger.endTag();
			timingLogger.forceEndTag();
		}
	);
}

function scrollToNewReplies (behavior, callback = () => {}) {
	/*
	 * possible behavior:
	 *
	 * 'none' - no scrolling
	 * 'auto' - scroll when current scroll position is close to the
	 *          bottom of view
	 * 'always' - always scroll
	 */

	if (behavior === 'none') {
		callback();
		return;
	}

	const rule = getRule();
	if (!rule) {
		callback();
		return;
	}

	const scrollTop = docScrollTop();
	const distance = rule.nextSibling.getBoundingClientRect().top - Math.floor(viewportRect.height / 2);
	if (distance <= 0) {
		callback();
		return;
	}

	const scrollRatio = scrollTop / (document.documentElement.scrollHeight - viewportRect.height);
	if (behavior === 'auto') {
		if (scrollRatio < 0.8) {
			callback();
			return;
		}
	}

	if (document.hidden) {
		window.scrollTo(0, scrollTop + distance);
		callback();
		return;
	}

	let startTime = null;
	window.requestAnimationFrame(function handleScroll (time) {
		if (!startTime) {
			startTime = time;
		}
		const elapsed = time - startTime;
		if (elapsed < RELOAD_AUTO_SCROLL_CONSUME) {
			window.scrollTo(
				0,
				Math.floor(scrollTop + distance * (elapsed / RELOAD_AUTO_SCROLL_CONSUME)));
			window.requestAnimationFrame(handleScroll);
		}
		else {
			window.scrollTo(0, scrollTop + distance);
			callback();
		}
	});
}

function runMomocan () {
	if (typeof Akahuku.momocan === 'undefined') {
		return Promise.resolve();
	}

	return new Promise(resolve => {
		let momocan = Akahuku.momocan.create({
			onmarkup: markup => {
				const imagePath = chrome.runtime.getURL('/images/momo/');
				return markup
					.replace(/\/\/dev\.appsweets\.net\/momo\//g, imagePath)
					.replace(/\/@version@/g, '');
			},
			onok: canvas => {
				getBlobFrom(canvas).then(blob => {
					if (pageModes[0].mode == 'summary' || pageModes[0].mode == 'catalog') {
						overrideUpfile = {
							name: 'tegaki.png',
							data: blob
						};
					}
					else {
						const baseform = document.getElementsByName('baseform')[0];
						if (baseform) {
							baseform.value = canvas.toDataURL().replace(/^[^,]+,/, '');
						}
					}
					resetForm('upfile', 'textonly');
					return setPostThumbnail(canvas, '手書き');
				});
			},
			oncancel: () => {
			},
			onclose: () => {
				momocan = null;
				resolve();
			}
		});

		momocan.start();
	});
}

/*
 * <<<1 functions which handles a thumbnail for posting image
 */

function setPostThumbnailVisibility (visible) { /*returns promise*/
	const thumb = $('post-image-thumbnail-wrap');
	if (!thumb) return Promise.resolve();
	if (!thumb.getAttribute('data-available')) {
		thumb.classList.add('hide');
		return Promise.resolve();
	}

	thumb.classList.remove('hide');

	return delay(0).then(() => {
		// show
		if (visible) {
			thumb.classList.add('run');
			return transitionendp(thumb, 400);
		}

		// hide
		else {
			thumb.classList.remove('run');
			return transitionendp(thumb, 400).then(() => {
				thumb.classList.add('hide');
			});
		}
	});
}

function getThumbnailSize (width, height, maxWidth, maxHeight) {
	if (width > maxWidth || height > maxHeight) {
		const ratio = Math.min(maxWidth / width, maxHeight / height);
		return {
			width: Math.floor(width * ratio + 0.5),
			height: Math.floor(height * ratio + 0.5)
		};
	}
	else {
		return {width, height};
	}
}

function doDisplayThumbnail (thumbWrap, thumb, media) { /*returns promise*/
	let p = Promise.resolve();

	if (!media) {
		return p;
	}

	if (media instanceof HTMLVideoElement) {
		p = p.then(() => new Promise(resolve => {
			/*
			function f1 (ev) {
				console.log(`event: ${ev.type}`);
			}
			[
				'abort', 'canplay', 'canplaythrough', 'durationchange', 'emptied', 'encrypted',
				'ended', 'error', 'interruptbegin', 'interruptend', 'loadeddata', 'loadedmetadata',
				'loadstart', 'pause', 'play', 'playing', 'progress', 'ratechange', 'seeked',
				'seeking', 'stalled', 'suspend', 'volumechange', 'waiting', 'timeupdate'
			].forEach(en => {
				media.addEventListener(en, f1);
			});
			*/

			media.addEventListener('timeupdate', () => {
				if (media.dataset.resolved != '1') {
					media.dataset.resolved = '1';
					media.pause();
					resolve();
				}
			}, {once: true});

			setTimeout(() => {
				if (media.dataset.resolved != '1') {
					media.dataset.resolved = '1';
					media.pause();
					resolve();
				}
			}, 1000);

			media.muted = true;
			media.play();
		}));
	}

	return p.then(() => {
		const containerWidth = Math.min(Math.floor(viewportRect.width / 4 * 0.8), 250);
		const containerHeight = Math.min(Math.floor(viewportRect.width / 4 * 0.8), 250);
		const naturalWidth = media.naturalWidth || media.videoWidth || media.width;
		const naturalHeight = media.naturalHeight || media.videoHeight || media.height;
		const size = getThumbnailSize(
			naturalWidth, naturalHeight,
			containerWidth, containerHeight);

		const canvas = document.createElement('canvas');
		canvas.width = size.width;
		canvas.height = size.height;

		const c = canvas.getContext('2d');
		c.fillStyle = '#f0e0d6';
		c.fillRect(0, 0, canvas.width, canvas.height);
		c.drawImage(
			media,
			0, 0, naturalWidth, naturalHeight,
			0, 0, canvas.width, canvas.height);

		thumbWrap.classList.add('hide');
		thumb.classList.remove('run');
		thumbWrap.setAttribute('data-available', '2');
		thumb.width = canvas.width;
		thumb.height = canvas.height;
		thumb.src = canvas.toDataURL();

		commands.activatePostForm('doDisplayThumbnail')
	});
}

function setPostThumbnail (file, caption) { /*returns promise*/
	const thumbWrap = $('post-image-thumbnail-wrap');
	const thumb = $('post-image-thumbnail');

	if (!thumbWrap || !thumb) return Promise.resolve();

	if (!file || 'type' in file && !/^(?:image\/(?:jpeg|png|webp|gif))|video\/(?:webm|mp4)$/.test(file.type)) {
		thumbWrap.removeAttribute('data-available');
		return setPostThumbnailVisibility(false);
	}

	if (file instanceof HTMLCanvasElement
	||  file instanceof HTMLImageElement
	||  file instanceof HTMLVideoElement) {
		$t('post-image-thumbnail-info', caption || `(on demand content)`);
		return doDisplayThumbnail(thumbWrap, thumb, file);
	}
	else {
		$t('post-image-thumbnail-info', `${file.type}, ${getReadableSize(file.size)}`);
		return getImageFrom(file).then(img => doDisplayThumbnail(thumbWrap, thumb, img));
	}
}

/*
 * <<<1 common panel tab handling functions
 */

function showPanel (callback) {
	const panel = $('panel-aside-wrap');

	// hide ad container
	$('ad-aside-wrap').classList.add('hide');

	// if catalog mode, ensure right margin
	if (pageModes[0].mode == 'catalog') {
		Array.from($qsa('#catalog .catalog-threads-wrap > div'))
			.forEach(div => {div.style.marginRight = '24%';});
	}

	if (panel.classList.contains('run')) {
		callback && callback(panel);
	}
	else {
		// show panel container
		setTimeout(() => {panel.classList.add('run')}, 0);
		callback && transitionend(panel, e => {
			callback(panel);
		});
	}
}

function hidePanel (callback) {
	const panel = $('panel-aside-wrap');

	if (panel.classList.contains('run')) {
		setTimeout(() => {panel.classList.remove('run')}, 0);
		transitionend(panel, e => {
			// if catalog mode, restore right margin
			if (pageModes[0].mode == 'catalog') {
				Array.from($qsa('#catalog .catalog-threads-wrap > div'))
					.forEach(div => {div.style.marginRight = '';});
			}
			// summary/reply mode: show ad container
			else {
				$('ad-aside-wrap').classList.remove('hide');
			}

			callback && callback(e.target);
		});
	}
	else {
		callback && callback(panel);
	}
}

function activatePanelTab (tab) {
	let tabId = /#(.+)/.exec(tab.href);
	if (!tabId) return;
	tabId = tabId[1];

	$qsa('.panel-tab-wrap .panel-tab', 'panel-aside-wrap').forEach(node => {
		node.classList.remove('active');
		if (node.getAttribute('href') == `#${tabId}`) {
			node.classList.add('active');
		}
	});

	$qsa('.panel-content-wrap', 'panel-aside-wrap').forEach(node => {
		node.classList.add('hide');
		if (node.id == `panel-content-${tabId}`) {
			node.classList.remove('hide');
		}
	});
}

/*
 * <<<1 search panel tab handling functions
 */

function searchBase (opts) {
	return modules('reply-search-utils').then(module => {
		const query = $('search-text').value;
		if (/^[\s\u3000]*$/.test(query)) {
			return;
		}

		const tester = module.createQueryCompiler().compile(query);
		if (tester.message) {
			$t('search-result-count', tester.message);
			return;
		}

		const result = $('search-result');
		let matched = 0;
		$('search-guide').classList.add('hide');
		empty(result);

		const nodes = Array.from($qsa(opts.targetNodesSelector));
		if (opts.sort) {
			nodes.sort(opts.sort);
		}

		nodes.forEach(node => {
			let text = [];
			$qsa(opts.targetElementSelector, node).forEach(subNode => {
				let t = opts.getTextContent(subNode);
				t = t.replace(/^\s+|\s+$/g, '');
				text.push(t);
			});
			text = module.getLegalizedStringForSearch(text.join('\t'));

			if (tester.test(text)) {
				const anchor = result.appendChild(document.createElement('a'));
				const postNumber = opts.getPostNumber(node);
				anchor.href = '#search-item';
				anchor.setAttribute('data-number', postNumber);
				opts.fillItem(anchor, node);
				matched++;
			}
		});

		$t('search-result-count', `${matched} 件を抽出`);
	});
}

/*
 * <<<1 application commands
 */

const commands = {

	/*
	 * general functionalities
	 */

	activatePostForm: reason => { /*returns promise*/
		devMode && console.dir(reason);
		catalogPopup.deleteAll();
		$('com').focus();
		const postformWrap = $('postform-wrap');
		postformWrap.classList.add('hover');

		return Promise.all([
			transitionendp(postformWrap, 400),
			setPostThumbnailVisibility(true)
		]);
	},
	deactivatePostForm: () => { /*returns promise*/
		const postformWrap = $('postform-wrap');
		postformWrap.classList.remove('hover');
		document.activeElement.blur();
		document.body.focus();

		return Promise.all([
			transitionendp(postformWrap, 400),
			setPostThumbnailVisibility(false)
		]);
	},
	scrollPage: e => {
		const sh = document.documentElement.scrollHeight;
		if (!e.shiftKey && scrollManager.lastScrollTop >= sh - viewportRect.height) {
			invokeMousewheelEvent();
		}
		else if (storage.config.hook_space_key.value) {
			window.scrollBy(
				0, Math.floor(viewportRect.height / 2) * (e.shiftKey ? -1 : 1));
		}
		else {
			return keyManager.PASS_THROUGH;
		}
	},
	clearUpfile: () => { /*returns promise*/
		resetForm('upfile', 'baseform');
		overrideUpfile = undefined;
		return setPostThumbnail();
	},
	summaryBack: () => {
		const current = $qs('.nav .nav-links .current');
		if (!current || !current.previousSibling) return;
		if (transport.isRapidAccess('reload-summary')) return;
		historyStateWrapper.pushState(current.previousSibling.href);
	},
	summaryNext: () => {
		const current = $qs('.nav .nav-links .current');
		if (!current || !current.nextSibling) return;
		if (transport.isRapidAccess('reload-summary')) return;
		historyStateWrapper.pushState(current.nextSibling.href);
	},
	clearCredentials: async (e, t) => { /*returns promise*/
		const content = t.textContent;
		t.disabled = true;
		try {
			$t(t, '処理中...');
			const fileSystems = await resourceSaver.fileSystemManager.get(
				ASSET_FILE_SYSTEM_NAME, THREAD_FILE_SYSTEM_NAME);
			await Promise.all(Object.keys(fileSystems).map(id => fileSystems[id].forgetRootDirectory()));
			$t(t, '完了');
			await delay(1000);
		}
		finally {
			$t(t, content);
			t.disabled = false;
		}
	},

	/*
	 * reload/post
	 */

	reload: (...args) => { /*returns promise*/
		switch (pageModes[0].mode) {
		case 'summary':
			return commands.reloadSummary.apply(commands, args);
		case 'reply':
			{
				const now = Date.now();
				let reloader;
				if (now - reloadStatus.lastReloaded < storage.config.full_reload_interval.value * 1000 * 60) {
					reloader = commands.reloadRepliesViaAPI;
				}
				else {
					reloadStatus.lastReloaded = now;
					reloader = commands.reloadReplies;
				}
				return reloader.apply(commands, args).then(() => {
					if (resourceSaver.threadSaverRunning && reloadStatus.lastStatus == 404) {
						return resourceSaver
							.thread()
							.then(saver => saver.stop());
					}
				});
			}
		case 'catalog':
			return commands.reloadCatalog.apply(commands, args);
		default:
			throw new Error(`Unknown page mode: ${pageModes[0].mode}`);
		}
	},
	reloadSummary: () => { /*returns promise*/
		const TRANSPORT_TYPE = 'reload-summary';

		let content = $('content');
		let indicator = $('content-loading-indicator');
		let footer = $('footer');

		if (transport.isRunning(TRANSPORT_TYPE)) {
			transport.abort(TRANSPORT_TYPE);
			indicator.classList.add('error');
			$t(indicator, '中断しました');
			return Promise.resolve();
		}

		if (transport.isRapidAccess(TRANSPORT_TYPE)) {
			return Promise.resolve();
		}

		if (pageModes[0].mode != 'summary') {
			return Promise.resolve();
		}

		$t(indicator, '読み込み中です。ちょっとまってね。');
		content.style.height = content.offsetHeight + 'px';
		content.classList.add('init');
		indicator.classList.remove('hide');
		indicator.classList.remove('error');
		footer.classList.add('hide');

		return Promise.all([
			transitionendp(content, 400),
			reloadBase(TRANSPORT_TYPE)
		]).then(data => {
			const [transitionResult, reloadResult] = data;
			const {doc, now, status} = reloadResult;

			let fragment;
			reloadStatus.lastStatus = status;

			switch (status) {
			case 304:
				window.scrollTo(0, 0);
				return delay(WAIT_AFTER_RELOAD).then(() => {
					footer.classList.remove('hide');
					content.classList.remove('init');
					content = indicator = null;
					timingLogger.endTag();
				});
			}

			if (!doc) {
				throw new Error(`内容が変だよ (${status})`);
			}

			timingLogger.startTag('generate internal xml');
			try {
				timingLogger.startTag('generate');
				const xml = xmlGenerator.run(doc.documentElement.innerHTML).xml;
				timingLogger.endTag();

				timingLogger.startTag('applying data bindings');
				applyDataBindings(xml);
				timingLogger.endTag();

				timingLogger.startTag('transforming');
				xsltProcessor.setParameter(null, 'render_mode', 'threads');
				fragment = fixFragment(xsltProcessor.transformToFragment(xml, document));
				timingLogger.endTag();
			}
			finally {
				timingLogger.endTag();
			}

			timingLogger.startTag(`waiting (max ${WAIT_AFTER_RELOAD} msecs)`);
			return delay(Math.max(0, WAIT_AFTER_RELOAD - (Date.now() - now)))
			.then(() => {
				timingLogger.endTag();

				timingLogger.startTag('appending the contents');
				empty(content);
				window.scrollTo(0, 0);
				content.style.height = '';
				extractDisableOutputEscapingTags(content, fragment);
				fragment = null;
				timingLogger.endTag();

				timingLogger.startTag('transition');
				content.classList.remove('init');
				return transitionendp(content, 400);
			})
			.then(() => {
				timingLogger.endTag();

				footer.classList.remove('hide');
				content = indicator = footer = null;
				modifyPage();
				backend.send(
					'notify-viewers',
					{
						data: $('viewers').textContent - 0,
						siteInfo: siteInfo
					});

				timingLogger.forceEndTag();
			});
		})
		.catch(err => {
			footer.classList.remove('hide');
			indicator.classList.add('error');
			$t(indicator, err.message);
			console.error(`${APP_NAME}: reloadSummary failed: ${err.stack}`);
		})
		.finally(() => {
			transport.release(TRANSPORT_TYPE);
		});
	},
	reloadReplies: (opts = {}) => {
		const TRANSPORT_TYPE = ['reload-replies', opts.isAutotrack ? 'autotrack' : null]
			.filter(a => typeof a === 'string')
			.join('-');

		if (transport.isRunning(TRANSPORT_TYPE)) {
			transport.abort(TRANSPORT_TYPE);
			setReloaderStatus('中断しました');
			return Promise.resolve();
		}

		if (transport.isRapidAccess(TRANSPORT_TYPE)) {
			return Promise.resolve();
		}

		if (pageModes[0].mode != 'reply') {
			return Promise.resolve();
		}

		timingLogger.reset().startTag('reloading replies');
		setBottomStatus('読み込み中...', true);
		removeRule();
		postStats.resetPostformView();
		reloadStatus.lastRepliesCount = getRepliesCount();
		titleIndicator.stopBlink();
		dumpDebugText();

		return reloadBase(TRANSPORT_TYPE)
		.then(reloadResult => {
			const {doc, now, status} = reloadResult;

			let result;
			reloadStatus.lastStatus = status;

			switch (status) {
			case 404:
				setReloaderStatus();
				setBottomStatus('完了: 404 Not Found');
				$t('expires-remains', '-');
				$t('pf-expires-remains', '-');
				$t('reload-anchor', 'Not Found. ファイルがないよ。');
				timingLogger.forceEndTag();
				return;
			case 304:
				setReloaderStatus('更新なし');
				setBottomStatus('完了: フルリロード, 304 Not Modified');
				timingLogger.forceEndTag();
				return;
			case /^5[0-9]{2}$/.test(status) && status:
				setReloaderStatus(`サーバエラー`);
				setBottomStatus(`完了: フルリロード, サーバエラー ${status}`);
				timingLogger.forceEndTag();

				return;
			}

			if (!doc) {
				throw new Error(`内容が変だよ (${status})`);
			}

			// process topic block

			setBottomStatus('処理中...', true);

			timingLogger.startTag('generate internal xml for topic block');
			try {
				timingLogger.startTag('generate');
				result = xmlGenerator.run(doc.documentElement.innerHTML, 0, !!opts.isAfterPost);
				timingLogger.endTag();

				timingLogger.startTag('applying data bindings');
				applyDataBindings(result.xml);
				timingLogger.endTag();

				timingLogger.startTag('update topic mark,id,sodane');
				updateTopic(result.xml, document);
				timingLogger.endTag();
			}
			finally {
				timingLogger.endTag();
			}

			// process replies block

			backend.send(
				'notify-viewers',
				{
					viewers: $qs('meta viewers', result.xml).textContent - 0,
					siteInfo: siteInfo
				});

			timingLogger.forceEndTag();

			// process remaiing replies
			processRemainingReplies(
				opts,
				result.remainingRepliesContext,
				getLastReplyNumber(),
				newStat => {
					const message = newStat.delta.total ?
						`新着 ${newStat.delta.total} レス` :
						'新着レスなし';
					setReloaderStatus(message);

					const bottomMessage = [
						`完了: ${reloadStatus.size('lastReceivedCompressedBytes')} (フル)`,
						`, 計 ${reloadStatus.size('totalReceivedCompressedBytes')}`
					].join('');
					setBottomStatus(bottomMessage);
					//console.log(bottomMessage);
				}
			);
		})
		.catch(err => {
			setReloaderStatus(err.message, true);
			setBottomStatus(err.message);
			timingLogger.forceEndTag();
			console.error(`${APP_NAME}: reloadReplies failed: ${err.stack}`);
		})
		.finally(() => {
			transport.release(TRANSPORT_TYPE);

			if ('noticeNew' in siteInfo) {
				if (siteInfo.notice == siteInfo.noticeNew) {
					delete siteInfo.noticeNew;
				}
				else {
					if (siteInfo.notice != '') {
						detectNoticeModification(siteInfo.notice, siteInfo.noticeNew).then(() => {
							commands.activateNoticeTab();
							alert('注意書きが更新されたみたいです。');
						});
					}
					chrome.storage.sync.get({notices:{}}, result => {
						if (chrome.runtime.lastError) {
							console.error(`${APP_NAME}: reloadReplies(finally block): ${chrome.runtime.lastError.message}`);
						}
						else {
							result.notices[`${siteInfo.server}/${siteInfo.board}`] = siteInfo.noticeNew;
							storage.setSynced(result);
						}

						siteInfo.notice = siteInfo.noticeNew;
						delete siteInfo.noticeNew;
					});
				}
			}
		});
	},
	reloadRepliesViaAPI: (opts = {}) => {
		const TRANSPORT_MAIN_TYPE = ['reload-replies', opts.isAutotrack ? 'autotrack' : null]
			.filter(a => typeof a === 'string')
			.join('-');
		const TRANSPORT_SUB_TYPE = ['reload-replies-api', opts.isAutotrack ? 'autotrack' : null]
			.filter(a => typeof a === 'string')
			.join('-');

		if (transport.isRunning(TRANSPORT_MAIN_TYPE)) {
			transport.abort(TRANSPORT_MAIN_TYPE);
			setReloaderStatus('中断しました');
			return Promise.resolve();
		}

		if (transport.isRapidAccess(TRANSPORT_MAIN_TYPE)) {
			return Promise.resolve();
		}

		if (pageModes[0].mode != 'reply') {
			return Promise.resolve();
		}

		timingLogger.reset().startTag('reloading replies via API');
		setBottomStatus('読み込み中...', true);
		removeRule();
		postStats.resetPostformView();
		reloadStatus.lastRepliesCount = getRepliesCount();
		titleIndicator.stopBlink();
		dumpDebugText();

		let p;
		if (opts.skipHead) {
			p = Promise.resolve({
				doc: null,
				now: Date.now(),
				status: 200
			});
		}
		else {
			p = reloadBase(TRANSPORT_MAIN_TYPE, {method: 'head'});
		}

		return p.then(reloadResult => {
			const {doc, now, status} = reloadResult;

			reloadStatus.lastStatus = status;

			switch (status) {
			case 404:
				setReloaderStatus();
				setBottomStatus('完了: 404 Not Found');
				$t('expires-remains', '-');
				$t('pf-expires-remains', '-');
				$t('reload-anchor', 'Not Found. ファイルがないよ。');
				timingLogger.forceEndTag();
				return;
			case 304:
				setReloaderStatus('更新なし');
				setBottomStatus('完了: 差分リロード, 304 Not Modified');
				timingLogger.forceEndTag();
				return;
			case /^5[0-9]{2}$/.test(status) && status:
				setReloaderStatus(`サーバエラー`);
				setBottomStatus(`完了: 差分リロード, サーバエラー ${status}`);
				timingLogger.forceEndTag();
				return;
			}

			return reloadBaseViaAPI('')
			.then(reloadResult => {
				const {doc, now, status} = reloadResult;
				const result = xmlGenerator.runFromJson(
					doc,
					$qs('article .replies').childElementCount,
					!!opts.isAfterPost);

				xsltProcessor.setParameter(null, 'render_mode', 'replies');
				const container = getReplyContainer();
				const fragment = fixFragment(xsltProcessor.transformToFragment(result.xml, document));

				if ($qs('.reply-wrap', fragment)) {
					createRule(container);
					extractDisableOutputEscapingTags(container, fragment);
					stripTextNodes(container);

					const newStat = postStats.done();
					if ($qs('#panel-aside-wrap.run #panel-content-mark:not(.hide)')) {
						postStats.updatePanelView(newStat);
					}
					titleIndicator.startBlink();
					postStats.updatePostformView(newStat);

					const message = `新着 ${newStat.delta.total} レス`;
					setReloaderStatus(message);

					const bottomMessage = [
						`完了: ${reloadStatus.size('lastReceivedCompressedBytes')} (差分)`,
						`, 計 ${reloadStatus.size('totalReceivedCompressedBytes')}`
					].join('');
					setBottomStatus(bottomMessage);
					//console.log(bottomMessage);

					scrollToNewReplies(opts.scrollBehavior, () => {
						updateSodanePosts(newStat);
						updateIdFrequency(newStat);
						modifyPage();
						timingLogger.forceEndTag();
					});
				}
				else {
					const message = '新着レスなし';
					setReloaderStatus(message);

					const bottomMessage = [
						`完了: ${reloadStatus.size('lastReceivedCompressedBytes')} (差分)`,
						`, 計 ${reloadStatus.size('totalReceivedCompressedBytes')}`
					].join('');
					setBottomStatus(bottomMessage);
					//console.log(bottomMessage);

					timingLogger.forceEndTag();
				}
			});
		})
		.catch(err => {
			setReloaderStatus(err.message, true);
			setBottomStatus(err.message);
			timingLogger.forceEndTag();
			console.error(`${APP_NAME}: reloadRepliesViaAPI failed: ${err.stack}`);
		})
		.finally(() => {
			transport.release(TRANSPORT_MAIN_TYPE);
			transport.release(TRANSPORT_SUB_TYPE);
		});
	},
	reloadCatalog: () => { /*returns promise*/
		const TRANSPORT_MAIN_TYPE = 'reload-catalog-main';
		const TRANSPORT_SUB_TYPE = 'reload-catalog-sub';

		const sortMap = {
			'#catalog-order-default': {n:0, key:'default'},
			'#catalog-order-new': {n:1, key:'new'},
			'#catalog-order-old': {n:2, key:'old'},
			'#catalog-order-most': {n:3, key:'most'},
			'#catalog-order-less': {n:4, key:'less'},
			'#catalog-order-trend': {n:5, key:'trend'},
			//'#catalog-order-view': {n:7, key:'view'},
			'#catalog-order-sodane': {n:8, key:'sodane'},
			'#catalog-order-hist': {n:7, key:'hist'}
		};

		const p = $qs('#catalog .catalog-options a.active');
		const sortType = sortMap[p ? p.getAttribute('href') : '#catalog-order-default'];
		const wrap = $(`catalog-threads-wrap-${sortType.key}`);

		if (transport.isRunning(TRANSPORT_MAIN_TYPE)
		||  transport.isRunning(TRANSPORT_SUB_TYPE)) {
			transport.abort(TRANSPORT_MAIN_TYPE);
			transport.abort(TRANSPORT_SUB_TYPE);
			wrap.classList.remove('run');
			setBottomStatus('中断しました');
			return Promise.resolve();
		}

		if (transport.isRapidAccess(TRANSPORT_MAIN_TYPE)) {
			return Promise.resolve();
		}

		if (pageModes[0].mode != 'catalog') {
			return Promise.resolve();
		}

		// update catalog settings
		if (!wrap.firstChild) {
			const currentCs = getCatalogSettings();
			$('catalog-horz-number').value = currentCs[0];
			$('catalog-vert-number').value = currentCs[1];
			$('catalog-with-text').checked = currentCs[2] > 0;
		}

		commands.updateCatalogSettings({
			x: $('catalog-horz-number').value,
			y: $('catalog-vert-number').value,
			text: $('catalog-with-text').checked ? storage.config.catalog_text_max_length.value : 0
		});

		setBottomStatus('読み込み中...', true);
		catalogPopup.deleteAll();
		wrap.classList.add('run');

		return Promise.all([
			transitionendp(wrap, 300),
			reloadCatalogBase(TRANSPORT_MAIN_TYPE, sortType ? `&sort=${sortType.n}` : ''),
			reloadBase(TRANSPORT_SUB_TYPE),
			urlStorage.getAll()
		]).then(data => {
			const [transitionResult, reloadResult, summaryReloadResult, openedThreads] = data;
			const {doc, now, status} = reloadResult;

			const attributeConverter1 = {
				'href': (anchor, name, value) => {
					anchor.setAttribute(name, `/${siteInfo.board}/${value}`);
				},
				'target': (anchor, name, value) => {
					anchor.setAttribute(name, value);
				}
			};

			const attributeConverter2 = {
				'data-src': (img, pad, name, value) => {
					img.src = storage.config.catalog_thumbnail_scale.value >= 1.5 ?
						value.replace('/cat/', '/thumb/') : value;
				},
				'width': (img, pad, name, value) => {
					value = Math.floor((value - 0) * storage.config.catalog_thumbnail_scale.value);
					img.style.width = value + 'px';
				},
				'height': (img, pad, name, value) => {
					value = Math.floor((value - 0) * storage.config.catalog_thumbnail_scale.value);
					img.style.height = value + 'px';
				},
				'alt': (img, pad, name, value) => {
					img.setAttribute('alt', value);
				}
			};

			const cellImageWidth = Math.floor(CATALOG_THUMB_WIDTH * storage.config.catalog_thumbnail_scale.value);
			const cellImageHeight = Math.floor(CATALOG_THUMB_HEIGHT * storage.config.catalog_thumbnail_scale.value);
			const anchorWidth = cellImageWidth + CATALOG_ANCHOR_PADDING;
			const currentCs = getCatalogSettings();
			const newIndicator = wrap.childNodes.length ? 'new' : '';
			const newClass = wrap.childNodes.length ? 'new' : '';

			let insertee = wrap.firstChild;

			wrap.style.maxWidth = `${((anchorWidth + CATALOG_ANCHOR_MARGIN) * currentCs[0])}px`;

			/*
			 * in history sort, bring posted threads to the top
			 */

			if (sortType.n == 7) {
				let first = $qs('table[align="center"] td a', doc);
				if (first) {
					first = first.parentNode;

					$qsa('table[align="center"] td a', doc).forEach(node => {
						const href = /res\/(\d+)\.htm/.exec(node.getAttribute('href'));
						if (!href) return;
						const number = href[1] - 0;
						if (!(number in openedThreads)) return;
						if (openedThreads[number].post <= 0) return;

						node = node.parentNode;
						if (node == first) {
							first = node.nextSibling;
						}
						else {
							node.parentNode.removeChild(node);
							first.parentNode.insertBefore(node, first);
						}
					});
				}
			}

			/*
			 * traverse all anchors in new catalog
			 */

			$qsa('table[align="center"] td a', doc).forEach(node => {
				let threadNumber = /(\d+)\.htm/.exec(node.getAttribute('href'));
				if (!threadNumber) return;

				let repliesCount = 0, from, to;

				threadNumber = threadNumber[1] - 0;

				// number of replies
				from = $qs('font', node.parentNode);
				if (from) {
					repliesCount = from.textContent;
				}

				// find anchor already exists
				let anchor = $(`c-${sortType.key}-${threadNumber}`);
				if (anchor) {
					// found. reuse it
					if (anchor == insertee) {
						insertee = insertee.nextSibling;
					}
					anchor.parentNode.insertBefore(anchor, insertee);

					// update reply number and class name
					const info = $qs('.info', anchor);
					let oldRepliesCount = info.firstChild.textContent;
					info.firstChild.textContent = repliesCount;
					if (!isNaN(repliesCount - 0)
					&&  !isNaN(oldRepliesCount - 0)
					&&  repliesCount != oldRepliesCount) {
						repliesCount -= 0;
						oldRepliesCount -= 0;
						anchor.className = repliesCount > CATALOG_LONG_CLASS_THRESHOLD ? 'long' : '';
						info.lastChild.textContent =
							(repliesCount > oldRepliesCount ? '+' : '') +
							(repliesCount - oldRepliesCount);
					}
					else {
						anchor.className = '';
						info.lastChild.textContent = '';
					}

					return;
				}

				// not found. create new one
				anchor = wrap.insertBefore(document.createElement('a'), insertee);
				anchor.id = `c-${sortType.key}-${threadNumber}`;
				anchor.setAttribute('data-number', `${threadNumber},0`);
				anchor.style.width = anchorWidth + 'px';
				anchor.className = newClass;

				// image
				const imageWrap = anchor.appendChild(document.createElement('div'));
				imageWrap.className = 'image';
				imageWrap.style.height = cellImageHeight + 'px';

				// attribute conversion #1
				for (let atr in attributeConverter1) {
					const value = node.getAttribute(atr);
					if (value == null) continue;
					attributeConverter1[atr](anchor, atr, value);
				}

				from = $qs('img', node);
				if (from) {
					to = imageWrap.appendChild(document.createElement('img'));

					// attribute conversion #2
					for (let atr in attributeConverter2) {
						const value = from.getAttribute(atr);
						if (value == null) continue;
						attributeConverter2[atr](to, imageWrap, atr, value);
					}

					const imageNumber = /(\d+)s\.jpg/.exec(to.src)[1];
					anchor.setAttribute('data-number', `${threadNumber},${imageNumber}`);
				}

				// text
				from = $qs('small', node.parentNode);
				if (from) {
					to = anchor.appendChild(document.createElement('div'));
					to.className = 'text';
					to.textContent = getTextForCatalog(
						from.textContent.replace(/\u2501.*\u2501\s*!+/, '\u2501!!'), 4);
					to.setAttribute('data-text', from.textContent);
					if (/^>/.test(from.textContent)) {
						to.classList.add('quote');
					}
				}

				to = anchor.appendChild(document.createElement('div'));
				to.className = 'info';
				to.appendChild(document.createElement('span')).textContent = repliesCount;
				to.appendChild(document.createElement('span')).textContent = newIndicator;
			});

			// find latest post number
			if (summaryReloadResult.status >= 200 && summaryReloadResult.status <= 299) {
				const firstThread = $qs('div.thre', summaryReloadResult.doc);
				const comments = $qsa('input[type="checkbox"][value="delete"],span[id^="delcheck"]', firstThread);
				if (comments.length) {
					const last = comments[comments.length - 1];
					if (/^delcheck(\d+)/.test(last.id)) {
						siteInfo.latestNumber = RegExp.$1 - 0;
					}
					else if (last.name) {
						siteInfo.latestNumber = last.name - 0;
					}
				}
			}

			switch (sortType.n) {
			// default, old
			case 0: case 2:
				{
					const deleteLimit = siteInfo.latestNumber - siteInfo.logSize;

					// process all remaining anchors which have not changed and find dead thread
					while (insertee) {
						let [threadNumber, imageNumber] = insertee.getAttribute('data-number').split(',');
						threadNumber -= 0;
						imageNumber -= 0;

						let isDead = false;
						if (siteInfo.minThreadLifeTime == 0) {
							if (threadNumber < deleteLimit) {
								isDead = true;
							}
						}
						else {
							if (imageNumber == 0) {
								if (threadNumber < deleteLimit) {
									isDead = true;	// TODO: text-only thread may be considered to be dead even
													// though it is alive
								}
							}
							else {
								// treat imageNumber as the birth time of thread
								const age = now - imageNumber;
								if (threadNumber < deleteLimit && age > siteInfo.minThreadLifeTime) {
									isDead = true;
								}
							}
						}

						if (isDead) {
							const tmp = insertee.nextSibling;
							insertee.parentNode.removeChild(insertee);
							insertee = tmp;
						}
						else {
							insertee.className = '';
							$qs('.info', insertee).lastChild.textContent = '';
							insertee = insertee.nextSibling;
						}
					}

					// pick up and mark old threads
					const warnLimit = Math.floor(siteInfo.latestNumber - siteInfo.logSize * CATALOG_EXPIRE_WARN_RATIO);
					for (let node = wrap.firstChild; node; node = node.nextSibling) {
						let [threadNumber, imageNumber] = node.getAttribute('data-number').split(',');

						if (threadNumber in openedThreads) {
							node.classList.add('soft-visited');
						}

						threadNumber -= 0;
						imageNumber -= 0;

						const isAdult = imageNumber > 0 && now - imageNumber >= siteInfo.minThreadLifeTime;

						if (threadNumber < warnLimit
						&& (siteInfo.minThreadLifeTime == 0 || imageNumber == 0 || isAdult)) {
							node.classList.add('warned');
						}
					}
				}
				break;

			// new, most, less, trend, sodane, hist
			default:
				{
					while (insertee) {
						const tmp = insertee.nextSibling;
						insertee.parentNode.removeChild(insertee);
						insertee = tmp;
					}

					for (let node = wrap.firstChild; node; node = node.nextSibling) {
						let [threadNumber, imageNumber] = node.getAttribute('data-number').split(',');
						threadNumber -= 0;
						imageNumber -= 0;

						if (threadNumber in openedThreads) {
							if (sortType.n == 7) {
								if (openedThreads[threadNumber].post <= 0) {
									node.classList.add('soft-link');
									node.classList.remove('soft-visited');
								}
								else {
									node.classList.add('soft-visited');
								}
							}
							else {
								node.classList.add('soft-visited');
							}
						}
					}
				}
				break;
			}

			const activePanel = $qs('#panel-aside-wrap:not(.hide) .panel-tab.active');
			if (activePanel && /#search/.test(activePanel.href)) {
				commands.searchCatalog();
			}

			wrap.classList.remove('run');
			setBottomStatus('完了');
			window.scrollTo(0, 0);
		})
		.catch(err => {
			wrap.classList.remove('run');
			setBottomStatus('カタログの読み込みに失敗しました');
			console.error(`${APP_NAME}: reloadCatalog failed: ${err.stack}`);
		})
		.finally(() => {
			transport.release(TRANSPORT_MAIN_TYPE);
			transport.release(TRANSPORT_SUB_TYPE);
		});
	},
	post: () => { /*returns promise*/
		const TRANSPORT_TYPE = 'post';

		if (transport.isRunning(TRANSPORT_TYPE)) {
			transport.abort(TRANSPORT_TYPE);
			setBottomStatus('中断しました');
			registerReleaseFormLock();
			return Promise.resolve();
		}

		if (transport.isRapidAccess(TRANSPORT_TYPE)) {
			return Promise.resolve();
		}

		setBottomStatus('投稿中...');
		$qs('fieldset', 'postform').disabled = true;

		return postBase(TRANSPORT_TYPE, $('postform')).then(response => {
			if (!response) {
				throw new Error('サーバからの応答が変です');
			}

			response = response.replace(/\r\n|\r|\n/g, '\t');
			if (/warning/i.test(response)) {
				console.info(
					`${APP_NAME}: ` +
					`warning in response: ${response.replace(/.{1,72}/g, '$&\n')}`);
			}

			const baseUrl = `${location.protocol}//${location.host}/${siteInfo.board}/`;
			const result = parsePostResponse(response, baseUrl);

			if (result.error) {
				throw new Error(`サーバからの応答が変です (${result.error})`);
			}

			if (result.redirect) {
				return delay(WAIT_AFTER_POST).then(() => {
					commands.deactivatePostForm();
					setPostThumbnail();
					resetForm('com', 'com2', 'upfile', 'textonly', 'baseform');
					overrideUpfile = undefined;
					setBottomStatus('投稿完了');

					let actualPageMode = pageModes[0].mode;
					if (actualPageMode == 'reply' && $('post-switch-thread').checked) {
						actualPageMode = 'summary';
					}

					switch (actualPageMode) {
					case 'summary':
					case 'catalog':
						if (result.redirect != '') {
							backend.send('open', {
								url: result.redirect,
								selfUrl: location.href
							});
						}
						if ($('post-switch-reply')) {
							$('post-switch-reply').click();
						}
						break;
					case 'reply':
						if (storage.config.full_reload_after_post.value) {
							reloadStatus.lastReloaded = Date.now();
							return commands.reloadReplies({isAfterPost: true}).then(() => {
								return activeTracker.reset();
							});
						}
						else {
							return commands.reload({skipHead:true, isAfterPost: true}).then(() => {
								return activeTracker.reset();
							});
						}
					}
				});
			}
		})
		.catch(err => {
			setBottomStatus('投稿が失敗しました');
			console.error(`${APP_NAME}: post failed: ${err.stack}`);
			alert(err.message);
		})
		.finally(() => {
			registerReleaseFormLock();
			transport.release(TRANSPORT_TYPE);
		});
	},
	sodane: async (e, t) => { /*returns promise*/
		if (!t) return;
		if (t.getAttribute('data-busy')) return;

		const postNumber = getPostNumber(t);
		if (!postNumber) return;

		t.setAttribute('data-busy', '1');
		t.setAttribute('data-text', t.textContent);
		$t(t, '...');
		postStats.start();

		const url = `${location.protocol}//${location.host}/sd.php?${siteInfo.board}.${postNumber}`
		const options = {
			headers: {
				'X-Requested-With': `${APP_NAME}/${version}`
			}
		};
		const result = await load(url, options, 'text');
		try {
			if (result.error) {
				$t(t, t.getAttribute('data-text'));
				return;
			}

			const newSodaneValue = parseInt(result.content, 10) || 0;
			postStats.notifySodane(postNumber, newSodaneValue);
			if (newSodaneValue) {
				$t(t, newSodaneValue);
				t.classList.remove('sodane-null');
				t.classList.add('sodane');
			}
			else {
				$t(t, '＋');
				t.classList.add('sodane-null');
				t.classList.remove('sodane');
			}

			postStats.done();
			modifyPage();
		}
		finally {
			t.removeAttribute('data-busy');
			t.removeAttribute('data-text');
		}
	},
	quickModerate: (e, anchor) => {
		if (!anchor) return;
		if (anchor.classList.contains('posted')) return;

		const postNumber = getPostNumber(anchor);
		if (!postNumber) return;

		anchor.classList.add('posted');
		moderator.register(postNumber, QUICK_MODERATE_REASON_CODE, 1000 * 5);
	},

	/*
	 * dialogs
	 */

	openDeleteDialog: () => {
		modalDialog({
			title: '記事削除',
			buttons: 'ok, cancel',
			oninit: dialog => {
				const xml = document.implementation.createDocument(null, 'dialog', null);
				const checksNode = xml.documentElement.appendChild(xml.createElement('checks'));
				$qsa('article input[type="checkbox"]:checked').forEach(node => {
					checksNode.appendChild(xml.createElement('check')).textContent = getPostNumber(node);
				});
				xml.documentElement.appendChild(xml.createElement('delete-key')).textContent =
					getCookie('pwdc')
				dialog.initFromXML(xml, 'delete-dialog');
			},
			onopen: dialog => {
				const deleteKey = $qs('.delete-key', dialog.content);
				if (deleteKey) {
					deleteKey.focus();
				}
				else {
					dialog.initButtons('cancel');
				}
			},
			onok: dialog => {
				const TRANSPORT_TYPE = 'delete';

				let form = $qs('form', dialog.content);
				let status = $qs('.delete-status', dialog.content);
				if (!form || !status) return;

				if (transport.isRunning(TRANSPORT_TYPE)) {
					transport.abort(TRANSPORT_TYPE);
					$t(status, '中断しました。');
					dialog.isPending = false;
					return false;
				}

				if (transport.isRapidAccess(TRANSPORT_TYPE)) {
					$t(status, 'ちょっと待ってね。');
					dialog.isPending = false;
					return false;
				}

				form.action = `/${siteInfo.board}/futaba.php`;
				$t(status, '削除をリクエストしています...');
				dialog.isPending = true;
				postBase(TRANSPORT_TYPE, form).then(response => {
					response = response.replace(/\r\n|\r|\n/g, '\t');
					const result = parsePostResponse(response);

					if (!result.redirect) {
						throw new Error(result.error || 'なんかエラー？');
					}

					$t(status, 'リクエストに成功しました');

					$qsa('article input[type="checkbox"]:checked').forEach(node => {
						node.checked = false;
					});

					return delay(WAIT_AFTER_POST).then(() => {
						dialog.isPending = false;
						dialog.close();
					});
				})
				.catch(err => {
					console.error(`${APP_NAME}: delete failed: ${err.stack}`);
					$t(status, err.message);
					dialog.enableButtons();
				})
				.finally(() => {
					dialog.isPending = false;
					form = status = dialog = null;
					transport.release(TRANSPORT_TYPE);
				});
			}
		});
	},
	openConfigDialog: () => {
		modalDialog({
			title: '設定',
			buttons: 'ok, cancel',
			oninit: dialog => {
				const xml = document.implementation.createDocument(null, 'dialog', null);
				const itemsNode = xml.documentElement.appendChild(xml.createElement('items'));
				itemsNode.setAttribute('prefix', 'config-item.');

				const config = storage.config;
				for (let i in config) {
					const item = itemsNode.appendChild(xml.createElement('item'));
					item.setAttribute('internal', i);
					item.setAttribute('name', config[i].name);
					item.setAttribute('value', config[i].value);
					item.setAttribute('type', config[i].type);
					'desc' in config[i] && item.setAttribute('desc', config[i].desc);
					'min' in config[i] && item.setAttribute('min', config[i].min);
					'max' in config[i] && item.setAttribute('max', config[i].max);

					if ('list' in config[i]) {
						for (let j in config[i].list) {
							const li = item.appendChild(xml.createElement('li'));
							li.textContent = config[i].list[j];
							li.setAttribute('value', j);
							j == config[i].value && li.setAttribute('selected', 'true');
						}
					}
				}
				dialog.initFromXML(xml, 'config-dialog');

				setTimeout(() => {
					// special element for mouse wheel unit
					const wheelUnit = $qs('input[name="config-item.wheel_reload_unit_size"]');
					if (wheelUnit) {
						const span = wheelUnit.parentNode.insertBefore(
							document.createElement('span'), wheelUnit.nextSibling);
						span.id = 'wheel-indicator';
						wheelUnit.addEventListener('wheel', e => {
							$('wheel-indicator').textContent = `移動量: ${e.deltaY}`;
							e.preventDefault();
						});
					}
				}, 100);
			},
			onok: dialog => {
				const storageData = {};
				populateTextFormItems(dialog.content, item => {
					const name = item.name.replace(/^config-item\./, '');
					let value = item.value;

					if (item.nodeName == 'INPUT') {
						switch (item.type) {
						case 'checkbox':
							value = item.checked;
							break;
						}
					}

					storageData[name] = value;
				}, true);
				storage.assignConfig(storageData);
				storage.saveConfig();
				applyDataBindings(xmlGenerator.run().xml);
			}
		});
	},
	openModerateDialog: (e, anchor) => {
		if (!anchor) return;
		if (anchor.getAttribute('data-busy')) return;

		const postNumber = getPostNumber(anchor);
		if (!postNumber) return;

		anchor.setAttribute('data-busy', '1');

		async function load (url, opts) {
			const response = await fetch(url, opts);
			if (!response.ok) {
				throw new Error(`${response.status} ${response.statusText}`);
			}

			return (new TextDecoder('Shift_JIS')).decode(await response.arrayBuffer());
		}

		function modalDialogP (opts) {
			return new Promise(resolve => {
				opts.onapply = opts.onok = opts.oncancel = dialog => {
					dialog.isPending = true;
					resolve(dialog);
				};
				modalDialog(opts);
			});
		}

		const baseUrl = `${location.protocol}//${location.host}/`;

		load(`${baseUrl}del.php?b=${siteInfo.board}&d=${postNumber}`)
		.then(text => modalDialogP({
			title: 'del の申請',
			buttons: 'ok, cancel',
			oninit: dialog => {
				const xml = document.implementation.createDocument(null, 'dialog', null);
				dialog.initFromXML(xml, 'moderate-dialog');
			},
			onopen: dialog => {
				const moderateTarget = $qs('.moderate-target', dialog.content);
				if (moderateTarget) {
					let wrapElement = getWrapElement(anchor);
					if (wrapElement) {
						wrapElement = sanitizeComment(wrapElement);

						// replace anchors to text
						$qsa('a', wrapElement).forEach(node => {
							node.parentNode.replaceChild(
								document.createTextNode(node.textContent),
								node);
						});

						moderateTarget.appendChild(wrapElement);
					}
				}

				const doc = getDOMFromString(text);
				const form = $qs('form[method="POST"]', doc);
				const moderateList = $qs('.moderate-form', dialog.content);
				if (form && moderateList) {
					// strip submit buttons
					$qsa('input[type="submit"]', form).forEach(node => {
						node.parentNode.removeChild(node);
					});

					// strip tab borders
					$qsa('table[border]', form).forEach(node => {
						node.removeAttribute('border');
					});

					// make reason-text clickable
					$qsa('input[type="radio"][name="reason"]', form).forEach(node => {
						const r = node.ownerDocument.createRange();
						const label = node.ownerDocument.createElement('label');
						r.setStartBefore(node);
						r.setEndAfter(node.nextSibling);
						r.surroundContents(label);
					});

					// select last used reason, if available
					if (storage.runtime.del.lastReason) {
						const node = $qs(`input[type="radio"][value="${storage.runtime.del.lastReason}"`, form);
						if (node) {
							node.checked = true;
						}
					}

					moderateList.appendChild(form);
				}
			}
		}))
		.then(dialog => {
			if (dialog.type == 'ok') {
				const form = $qs('form', dialog.content);

				$qsa('input[type="radio"]:checked', form).forEach(node => {
					storage.runtime.del.lastReason = node.value;
					storage.saveRuntime();
				});

				moderator.register(anchor, $qs('input[name="reason"]', form).value);
			}

			dialog.close();
		})
		.catch(err => {
			console.error(err);
		})
		.finally(() => {
			anchor.removeAttribute('data-busy');
		});
	},
	openHelpDialog: (e, anchor) => {
		modalDialog({
			title: 'キーボード ショートカット',
			buttons: 'ok',
			oninit: dialog => {
				const xml = document.implementation.createDocument(null, 'dialog', null);
				dialog.initFromXML(xml, 'help-dialog');
			}
		});
	},
	openDrawDialog: (e, anchor) => {
		modules('momocan').then(module => {
			if ($('momocan-container')) {
				return runMomocan();
			}
			else {
				const style = chrome.runtime.getURL('/styles/momocan.css');
				return Akahuku.momocan.loadStyle(style).then(runMomocan);
			}
		});
	},

	/*
	 * form functionalities
	 */

	toggleSage: () => {
		const email = $('email');
		if (!email) return;
		email.value = /\bsage\b/.test(email.value) ?
			email.value.replace(/\s*\bsage\b\s*/g, '') :
			`sage ${email.value}`;
		email.setSelectionRange(email.value.length, email.value.length);
	},
	voice: () => {
		const s = window.getSelection().toString();
		if (s == '') return;
		document.execCommand('insertText', false, voice(s));
	},
	semiVoice: () => {
		const s = window.getSelection().toString();
		if (s == '') return;
		document.execCommand('insertText', false, voice(s, true));
	},
	cursorPreviousLine: e => execEditorCommand('cursorPreviousLine', e),
	cursorNextLine: e => execEditorCommand('cursorNextLine', e),
	cursorBackwardWord: e => execEditorCommand('cursorBackwardWord', e),
	cursorForwardWord: e => execEditorCommand('cursorForwardWord', e),
	cursorBackwardChar: e => execEditorCommand('cursorBackwardChar', e),
	cursorForwardChar: e => execEditorCommand('cursorForwardChar', e),
	cursorDeleteBackwardChar: e => execEditorCommand('cursorDeleteBackwardChar', e),
	cursorDeleteBackwardWord: e => execEditorCommand('cursorDeleteBackwardWord', e),
	cursorDeleteBackwardBlock: e => execEditorCommand('cursorDeleteBackwardBlock', e),
	cursorBeginningOfLine: e => execEditorCommand('cursorBeginningOfLine', e),
	cursorEndOfLine: e => execEditorCommand('cursorEndOfLine', e),
	selectAll: e => execEditorCommand('selectAll', e),

	/*
	 * catalog
	 */

	toggleCatalogVisibility: () => {
		const threads = $('content');
		const catalog = $('catalog');
		const ad = $('ad-aside-wrap');
		const panel = $('panel-aside-wrap');

		let scrollTop = 0;

		// activate catalog
		if (pageModes.length == 1) {
			pageModes.unshift({mode: 'catalog', scrollTop: docScrollTop()});
			threads.classList.add('hide');
			catalog.classList.remove('hide');
			ad.classList.add('hide');
			$t($qs('#header a[href="#toggle-catalog"] span'), siteInfo.resno ? 'スレッド' : 'サマリー');

			if (panel.classList.contains('run')) {
				Array.from($qsa('#catalog .catalog-threads-wrap > div'))
					.forEach(div => {div.style.marginRight = '24%';});
			}

			const active = $qs(
				'#catalog .catalog-threads-wrap > div:not([class*="hide"])');
			if (active && active.childNodes.length == 0) {
				commands.reloadCatalog();
			}

			historyStateWrapper.updateHash('mode=cat');
		}

		// deactivate catalog
		else {
			scrollTop = pageModes.shift().scrollTop;
			threads.classList.remove('hide');
			catalog.classList.add('hide');
			ad.classList.remove('hide');
			$t($qs('#header a[href="#toggle-catalog"] span'), 'カタログ');
			catalogPopup.deleteAll();
			historyStateWrapper.updateHash('');
		}

		setTimeout(() => {
			window.scrollTo(0, scrollTop);
		}, 0);
	},
	updateCatalogSettings: settings => {
		const cs = getCatalogSettings();
		if ('x' in settings) {
			const tmp = parseInt(settings.x, 10);
			if (!isNaN(tmp) && tmp >= 1 && tmp <= 20) {
				cs[0] = tmp;
			}
		}
		if ('y' in settings) {
			const tmp = parseInt(settings.y, 10);
			if (!isNaN(tmp) && tmp >= 1 && tmp <= 100) {
				cs[1] = tmp;
			}
		}
		if ('text' in settings) {
			const tmp = parseInt(settings.text, 10);
			if (!isNaN(tmp) && tmp >= 0 && tmp <= 1000) {
				cs[2] = tmp;
			}
		}
		setBoardCookie('cxyl', cs.join('x'), CATALOG_COOKIE_LIFE_DAYS);
	},

	/*
	 * thread auto tracking
	 */

	registerAutotrack: () => {
		if (reloadStatus.lastStatus == 404) {
			return;
		}
		if (activeTracker.running) {
			activeTracker.stop();
		}
		else {
			activeTracker.start();
		}
	},

	/*
	 * thread auto saving
	 */

	registerAutosave: () => { /*returns promise*/
		return resourceSaver.thread().then(saver => {
			if (saver.running) {
				return saver.stop();
			}
			else {
				return saver.start();
			}
		});
	},

	/*
	 * asset saving
	 */

	saveAsset: async anchor => { /*returns promise*/
		async function createContextMenuItems () {
			const items = [];

			// LRU items
			if (storage.runtime.kokoni.lru.length) {
				storage.runtime.kokoni.lru.forEach((lruItem, index) => {
					items.push({
						key: `lru-${index}`,
						label: lruItem.label,
						path: lruItem.path
					});
				});
				items.push({key: '-'});
			}

			// directory tree
			items.push(
				{
					key: 'kokoni',
					label: 'ここに保存',
					items: await assetSaver.getDirectoryTree()
				}
			);

			// misc items
			items.push(
				{key: '-'},
				{key: 'save-asset', label: '既定の場所に保存'},
				{key: 'refresh', label: 'フォルダツリーを更新'},
				{key: 'reset-hist', label: '履歴をクリア'}
			);

			return items;
		}

		const assetSaver = await resourceSaver.asset();
		if (assetSaver.busy) return;

		const contextMenu = await modules('menu').then(menu => menu.createContextMenu());
		const permission = await assetSaver.fileSystemAccess.queryRootDirectoryPermission(true)

		if (permission !== 'granted') {
			// display context menu
			const CONTEXT_MENU_KEY = 'grant-context';
			let item;

			anchor.classList.add('active');
			try {
				item = await contextMenu.assign({
					key: CONTEXT_MENU_KEY,
					items: [{key: 'request-grant', label: 'ファイルアクセスを許可する'}]
				})
				.open(anchor, CONTEXT_MENU_KEY);
			}
			finally {
				anchor.classList.remove('active');
			}
			if (!item) return;

			// execute the job for menu item
			await assetSaver.updateDirectoryTree();
		}
		else {
			// display context menu
			const CONTEXT_MENU_KEY = 'save-asset-context';
			let item;

			anchor.classList.add('active');
			try {
				item = await contextMenu.assign({
					key: CONTEXT_MENU_KEY,
					items: await createContextMenuItems()
				})
				.open(anchor, CONTEXT_MENU_KEY);
			}
			finally {
				anchor.classList.remove('active');
			}
			if (!item) return;

			// execute the job for each item
			const key = item.fullKey.substring(CONTEXT_MENU_KEY.length + 1);
			switch (key) {
			case 'save-asset':
				// save to the location specified by template
				await assetSaver.save(anchor, {
					template: storage.config.save_image_name_template.value
				});
				break;

			case 'refresh':
				// refresh directory tree
				await assetSaver.updateDirectoryTree();
				break;

			case 'reset-hist':
				// clear LRU items
				assetSaver.clearLRUList();
				break;

			case /^lru-/.test(key) && key:
			case /^kokoni,/.test(key) && key:
				// save to the location used in the past
				// save to the arbitrary location
				await assetSaver.save(anchor, {
					template: storage.config.save_image_kokoni_name_template.value,
					pathOverride: item.path
				});
				assetSaver.updateLRUList(item);
				break;
			}
		}
	},

	/*
	 * panel commons
	 */

	togglePanelVisibility: () => {
		if ($('panel-aside-wrap').classList.contains('run')) {
			commands.hidePanel();
		}
		else {
			commands.showPanel();
		}
	},
	hidePanel: () => {
		hidePanel();
	},
	showPanel: () => {
		showPanel();
	},
	activateStatisticsTab: () => {
		if (!$qs('#panel-aside-wrap.run #panel-content-mark:not(.hide)') && postStats.lastStats) {
			postStats.updatePanelView(postStats.lastStats);
		}
		activatePanelTab($qs('.panel-tab[href="#mark"]'));
		showPanel();
	},
	activateSearchTab: () => {
		const searchTab = $qs('.panel-tab[href="#search"]');
		activatePanelTab(searchTab);
		$t($qs('span.long', searchTab),
			(pageModes[0].mode == 'catalog' ? 'スレ' : 'レス') + '検索');
		showPanel(panel => {
			$('search-text').focus();
		});
	},
	activateNoticeTab: () => {
		activatePanelTab($qs('.panel-tab[href="#notice"]'));
		showPanel();
	},

	/*
	 * panel (search)
	 */

	search: () => {
		if (pageModes[0].mode == 'catalog') {
			commands.searchCatalog();
		}
		else {
			commands.searchComment();
		}
	},
	searchComment: () => {
		searchBase({
			targetNodesSelector: 'article .topic-wrap, article .reply-wrap',
			targetElementSelector: '.sub, .name, .postdate, span.user-id, .email, .comment',
			getTextContent: node => {
				// to optimize performance
				if (node.childElementCount == 0) {
					return node.textContent;
				}
				else {
					return commentToString(node);
				}
			},
			getPostNumber: node => {
				return node.getAttribute('data-number')
					|| $qs('[data-number]', node).getAttribute('data-number');
			},
			fillItem: (anchor, target) => {
				anchor.textContent = commentToString($qs('.comment', target));
			}
		});
	},
	searchCatalog: () => {
		let currentMode = $qs('#catalog .catalog-options a.active');
		if (!currentMode) return;

		let re = currentMode = /#catalog-order-(\w+)/.exec(currentMode.href);
		if (!re) return;

		currentMode = re[1];

		searchBase({
			targetNodesSelector: `#catalog-threads-wrap-${currentMode} a`,
			targetElementSelector: '.text, .info :first-child',
			sort: (a, b) => {
				if (a.classList.contains('new')) {
					return -1;
				}
				if (b.classList.contains('new')) {
					return 1;
				}
				return 0;
			},
			getTextContent: node => {
				return node.getAttribute('data-text') || node.textContent;
			},
			getPostNumber: node => {
				return node.getAttribute('data-number');
			},
			fillItem: (anchor, target) => {
				anchor.href = target.href;
				anchor.target = target.target;
				if (target.classList.contains('new')) {
					anchor.classList.add('new');
				}

				const img = $qs('img', target);
				if (img) {
					anchor.appendChild(img.cloneNode(false));
				}

				const text = $qs('[data-text]', target);
				if (text) {
					anchor.appendChild(document.createTextNode(text.getAttribute('data-text')));
				}

				const sentinel = anchor.appendChild(document.createElement('div'));
				sentinel.className = 'sentinel';

				const info = $qsa('.info span', target);
				if (info) {
					if (target.classList.contains('new')) {
						$t(sentinel, `${info[0].textContent} レス (new)`);
					}
					else {
						$t(sentinel, `${info[0].textContent}${info[1].textContent} レス`);
					}
				}
				else {
					$t(sentinel, '--');
				}
			}
		});
	},

	/*
	 * debug commands
	 */

	reloadExtension: () => {
		if (!devMode) return;
		resources.clearCache();
		backend.send('reload');
	},
	toggleLogging: (e, t) => {
		if (!devMode) return;
		timingLogger.locked = !t.value;
	},
	dumpStats: (e, t) => {
		if (!devMode) return;
		dumpDebugText(postStats.dump());
	},
	dumpReloadData: (e, t) => {
		if (!devMode) return;
		const data = Object.assign({}, reloadStatus);
		delete data.lastReceivedText;
		dumpDebugText(JSON.stringify(data, null, '    ') + '\n\n' + reloadStatus.lastReceivedText);
	},
	emptyReplies: (e, t) => {
		if (!devMode) return;
		empty($qs('.replies'));
	},
	noticeTest: (e, t) => {
		if (!devMode) return;

		let lines = siteInfo.notice.split('\n');

		// delete
		lines.splice(2, 2);

		// replace
		lines = lines.map(t => t.replace(/(最大)(\d+)(レス)/g, ($0, $1, $2, $3) => $1 + (parseInt($2, 10) * 2) + $3));

		// add
		lines.push(`Appended line #1: ${Math.random()}`);
		lines.push(`Appended line #2: ${Math.random()}`);

		siteInfo.notice = lines.join('\n');
		setBottomStatus('notice modified for debug');
	},
	traverseTest: (e, t) => {
		resourceSaver.asset()
		.then(saver => {
			return saver.updateDirectoryTree();
		})
		.then(tree => {
			console.dir(tree);
		});
	}
};

/*
 * <<<1 bootstrap
 */

timingLogger.startTag(`booting ${APP_NAME}`);

timingLogger.startTag('waiting import of utility functions');
modules('utils').then(utils => {
	timingLogger.endTag();

	({$, $t, $qs, $qsa, empty, fixFragment, serializeXML, getCookie, setCookie,
	getDOMFromString, getImageMimeType, docScrollTop, docScrollLeft,
	transitionend, delay, transitionendp, dumpNode, getBlobFrom, getImageFrom,
	getReadableSize, regalizeEditable, getContentsFromEditable,
	setContentsToEditable, isHighSurrogate, isLowSurrogate, isSurrogate,
	resolveCharacterReference, 新字体の漢字を舊字體に変換, osaka, mergeDeep,
	getErrorDescription, load, substringWithStrictUnicode, invokeMousewheelEvent,
	voice} = utils);

	storage.assignChangedHandler((changes, areaName) => {
		switch (areaName) {
		case 'sync':
			if ('notices' in changes) {
				siteInfo.notice = changes.notices.newValue[`${siteInfo.server}/${siteInfo.board}`] || '';
			}
			if ('config' in changes) {
				const data = Object.assign(
					storage.getAllConfigDefault(),
					changes.config.newValue);
				storage.assignConfig(data);
				applyDataBindings(xmlGenerator.run().xml);
			}
			break;

		case 'local':
			if ('runtime' in changes) {
				storage.assignRuntime(changes.runtime.newValue);
			}
			break;
		}
	});
	Object.defineProperty(window.Akahuku, 'storage', {get: () => storage});

	if (location.href.match(/^[^:]+:\/\/([^.]+)\.2chan\.net(?::\d+)?\/([^\/]+)\/res\/(\d+)\.htm/)) {
		siteInfo.server = RegExp.$1;
		siteInfo.board = RegExp.$2;
		siteInfo.resno = RegExp.$3 - 0;
		pageModes.unshift({mode: 'reply', scrollTop: 0});
	}
	else if (location.href.match(/^[^:]+:\/\/([^.]+)\.2chan\.net(?::\d+)?\/([^\/]+)\/(?:([^.]+)\.htm)?/)) {
		siteInfo.server = RegExp.$1;
		siteInfo.board = RegExp.$2;
		siteInfo.summaryIndex = RegExp.$3 - 0 || 0;
		pageModes.unshift({mode: 'summary', scrollTop: 0});
	}

	timingLogger.startTag('waiting multiple promise completion');
	return Promise.all([
		// settings loader promise
		new Promise(resolve => {
			const defaultStorage = {
				version: '0.0.1',
				migrated: false,
				notices: {},
				config: storage.getAllConfigDefault()
			};
			chrome.storage.sync.get(defaultStorage, result => {
				if (chrome.runtime.lastError) {
					throw new Error(chrome.runtime.lastError.message);
				}

				/*
				 * if a default key-value set is specified, the result must be merged.
				 * but firefox does not do. (2020-01)
				 */
				if (IS_GECKO) {
					result = mergeDeep(defaultStorage, result);
				}

				resolve(result);
			});
		}),

		// runtime loader promise
		new Promise(resolve => {
			const defaultStorage = {
				runtime: storage.runtime
			};
			chrome.storage.local.get(defaultStorage, result => {
				if (chrome.runtime.lastError) {
					throw new Error(chrome.runtime.lastError.message);
				}

				if (IS_GECKO) {
					result = mergeDeep(defaultStorage, result);
				}

				resolve(result);
			});
		}),

		// backend connector promise
		backend.connect(),

		// DOM construction watcher promise
		new Promise(resolve => {
			function next () {
				scriptWatcher.disconnect();
				scriptWatcher = undefined;

				styleInitializer.done();
				styleInitializer = undefined;

				if (NOTFOUND_TITLE.test(document.title)
				||  UNAVAILABLE_TITLE.test(document.title)
				||  $('cf-wrapper')) {
					resolve(false);
				}
				else {
					let html = [];
					if (document.doctype instanceof Node) {
						html.push(new XMLSerializer().serializeToString(document.doctype));
					}
					html.push(document.documentElement.outerHTML);
					html = html.join('\n');
					document.body.innerHTML = `${APP_NAME}: ページを再構成しています。ちょっと待ってね。`;
					setTimeout(html => {
						bootVars.bodyHTML = html
							.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
							.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
							.replace(/>([^<]+)</g, ($0, content) => {
								content = resolveCharacterReference(content)
									.replace(/</g, '&lt;')
									.replace(/>/g, '&gt;');
								return `>${content}<`;
							});

						resolve(true);
					}, 0, html);
				}
			}

			if (document.readyState == 'complete'
			|| document.readyState == 'interactive') {
				next();
			}
			else {
				document.addEventListener('DOMContentLoaded', next, {once: true});
			}
		}),

		// fundamental xsl file loader promise
		resources.get(
			'/xsl/fundamental.xsl',
			{expires:DEBUG_ALWAYS_LOAD_XSL ? 1 : 1000 * 60 * 10}),
	]);
}).then(data => {
	const [syncedStorageData, localStorageData, backendConnection, runnable, xsl] = data;
	timingLogger.endTag();

	if (!runnable) {
		timingLogger.forceEndTag();
		return;
	}

	if (backendConnection) {
		version = backendConnection.version;
		devMode = backendConnection.devMode;
	}
	else {
		throw new Error(
			`${APP_NAME}: ` +
			`バックエンドに接続できません。中止します。`);
	}

	if (xsl === null) {
		throw new Error(
			`${APP_NAME}: ` +
			`内部用の XSL ファイルの取得に失敗しました。中止します。`);
	}

	if (version != syncedStorageData.version) {
		// TODO: storage format upgrade goes here

		storage.setSynced({version: version});
	}

	if (version != window.localStorage.getItem(`${APP_NAME}_version`)) {
		resources.clearCache();
		window.localStorage.setItem(`${APP_NAME}_version`, version);
	}

	siteInfo.notice = syncedStorageData.notices[`${siteInfo.server}/${siteInfo.board}`] || '';

	storage.assignConfig(syncedStorageData.config);
	storage.assignRuntime(localStorageData.runtime);

	return backend.send('initialized').then(() => transformWholeDocument(xsl));
})
.catch(err => {
	timingLogger.forceEndTag();
	console.dir(err);

	if (scriptWatcher) {
		scriptWatcher.disconnect();
		scriptWatcher = undefined;
	}

	if (styleInitializer) {
		styleInitializer.done();
		styleInitializer = undefined;
	}

	document.body.innerHTML = `${APP_NAME}: ${err.message}`;
	$t(document.body.appendChild(document.createElement('pre')), err.stack);
});

}

// vim:set ts=4 sw=4 fenc=UTF-8 ff=unix ft=javascript fdm=marker fmr=<<<,>>> :
