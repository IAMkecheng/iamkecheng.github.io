window.onload = function () {
	console.log("感谢您的浏览，期待能够加入贵公司！");
	loadPapers();
	loadProjects();
	// 页面加载完成后也同步一次高度
	setTimeout(syncSectionHeights, 500);
}

// 将 publicationDate 规范为可比较的 YYYY-MM-DD
function normalizePubDate(dateStr) {
	if (!dateStr) return '0000-00-00';
	const parts = String(dateStr).split('-');
	const y = parts[0] || '0000';
	const m = (parts[1] || '01').padStart(2, '0');
	const d = (parts[2] || '01').padStart(2, '0');
	return `${y}-${m}-${d}`;
}

// 从 citation 中提取作者列表
function getPaperAuthors(paper) {
	if (paper.authors) return paper.authors;
	if (!paper.citation) return '';
	const match = paper.citation.match(/^(.+?)\.\s*"/);
	return match ? match[1].trim() : '';
}

// 作者名中将本人加粗
function formatAuthors(authors) {
	return authors.replace(/Kecheng Lu/g, '<b>Kecheng Lu</b>');
}

// 加载并渲染论文列表
function loadPapers() {
	if (typeof papersData === 'undefined') {
		console.error('论文数据未加载，请确保 papers.js 已正确引入');
		document.getElementById('papers-list').innerHTML = '<li>加载论文数据失败，请刷新页面重试。</li>';
		return;
	}

	const papers = [...papersData].sort((a, b) =>
		normalizePubDate(b.publicationDate).localeCompare(normalizePubDate(a.publicationDate))
	);

	const papersList = document.getElementById('papers-list');
	papersList.innerHTML = '';

	papers.forEach((paper, index) => {
		const li = document.createElement('li');

		const h3 = document.createElement('h3');
		const titleSpan = document.createElement('span');
		const titleText = `${index + 1}. ${paper.title}.`;
		if (paper.doiUrl) {
			const titleLink = document.createElement('a');
			titleLink.href = paper.doiUrl;
			titleLink.target = '_blank';
			titleLink.innerHTML = `<b>${titleText}</b>`;
			titleSpan.appendChild(titleLink);
		} else {
			titleSpan.innerHTML = `<b>${titleText}</b>`;
		}
		h3.appendChild(titleSpan);

		if (paper.demoUrl && paper.demoUrlText) {
			const linkSpan = document.createElement('span');
			linkSpan.className = 'link';
			const link = document.createElement('a');
			link.href = paper.demoUrl.trim();
			link.target = '_blank';
			link.textContent = paper.demoUrlText;
			linkSpan.appendChild(link);
			h3.appendChild(linkSpan);
		}

		li.appendChild(h3);

		const contentUl = document.createElement('ul');
		contentUl.className = 'info-content';

		const authors = getPaperAuthors(paper);
		if (authors) {
			const authorsLi = document.createElement('li');
			authorsLi.innerHTML = formatAuthors(authors) + '.';
			contentUl.appendChild(authorsLi);
		}

		const venue = paper.venue || paper.venueFullName || '';
		if (venue || paper.venueLevel) {
			const venueLi = document.createElement('li');
			if (paper.venueLevel) {
				let levelHtml = paper.venueLevel.replace(
					/(CCF A类(?:会议|期刊))/g,
					'<b>$1</b>'
				);
				venueLi.innerHTML = `${venue}（${levelHtml}）`;
			} else {
				venueLi.textContent = venue;
			}
			contentUl.appendChild(venueLi);
		}

		if (paper.description) {
			const descLi = document.createElement('li');
			descLi.textContent = paper.description;
			contentUl.appendChild(descLi);
		}

		li.appendChild(contentUl);
		papersList.appendChild(li);
	});

	syncSectionHeights();
}

// 同步 side 和 main section 的高度
function syncSectionHeights() {
	// 使用 setTimeout 确保 DOM 已完全渲染
	setTimeout(() => {
		const sideSection = document.querySelector('.side');
		const mainSection = document.querySelector('.main');

		if (sideSection && mainSection) {
			const sideHeight = sideSection.offsetHeight;
			const mainHeight = mainSection.offsetHeight;

			// 将两个 section 的高度设置为较大的那个
			const maxHeight = Math.max(sideHeight, mainHeight);
			sideSection.style.minHeight = maxHeight + 'px';
			mainSection.style.minHeight = maxHeight + 'px';
		}
	}, 100);
}

// 切换论文列表的折叠/展开状态
function togglePapers() {
	const container = document.getElementById('papers-container');
	const icon = document.getElementById('toggle-papers-icon');

	if (container.classList.contains('collapsed')) {
		// 展开
		container.classList.remove('collapsed');
		icon.classList.remove('fa-chevron-down');
		icon.classList.add('fa-chevron-up');
	} else {
		// 折叠
		container.classList.add('collapsed');
		icon.classList.remove('fa-chevron-up');
		icon.classList.add('fa-chevron-down');
	}
}

// 加载并渲染项目列表
function loadProjects() {
	// 检查 projectsData 是否已加载
	if (typeof projectsData === 'undefined') {
		console.error('项目数据未加载，请确保 projects.js 已正确引入');
		document.getElementById('projects-list').innerHTML = '<li>加载项目数据失败，请刷新页面重试。</li>';
		return;
	}

	// 使用 projectsData
	const projects = projectsData;

	const projectsList = document.getElementById('projects-list');
	projectsList.innerHTML = '';

	projects.forEach((project, index) => {
		const li = document.createElement('li');

		// 生成项目标题
		const h3 = document.createElement('h3');
		h3.textContent = `${index + 1}. ${project.name}`;
		li.appendChild(h3);

		// 生成内容部分
		const contentUl = document.createElement('ul');
		contentUl.className = 'info-content';

		// 在线网站链接
		if (project.url) {
			const urlLi = document.createElement('li');
			urlLi.innerHTML = `在线网站：<a href="${project.url}" target="_blank">${project.urlText || '链接'}</a>`;
			contentUl.appendChild(urlLi);
		}

		// 项目简介
		if (project.description) {
			const descLi = document.createElement('li');
			descLi.innerHTML = `项目简介：${project.description}`;
			contentUl.appendChild(descLi);
		}

		li.appendChild(contentUl);
		projectsList.appendChild(li);
	});
}

// 切换项目列表的折叠/展开状态
function toggleProjects() {
	const container = document.getElementById('projects-container');
	const icon = document.getElementById('toggle-projects-icon');

	if (container.classList.contains('collapsed')) {
		// 展开
		container.classList.remove('collapsed');
		icon.classList.remove('fa-chevron-down');
		icon.classList.add('fa-chevron-up');
	} else {
		// 折叠
		container.classList.add('collapsed');
		icon.classList.remove('fa-chevron-up');
		icon.classList.add('fa-chevron-down');
	}
}
