window.onload = function () {
	console.log("感谢您的浏览，期待能够加入贵公司！");
	loadPapers();
	loadProjects();
	// 页面加载完成后也同步一次高度
	setTimeout(syncSectionHeights, 500);
}

// 加载并渲染论文列表
function loadPapers() {
	// 检查 papersData 是否已加载
	if (typeof papersData === 'undefined') {
		console.error('论文数据未加载，请确保 papers.js 已正确引入');
		document.getElementById('papers-list').innerHTML = '<li>加载论文数据失败，请刷新页面重试。</li>';
		return;
	}

	// 使用 papersData
	const papers = papersData;
	// 按年份倒序排列（最新的在前）
	// papers.sort((a, b) => b.year - a.year);

	const papersList = document.getElementById('papers-list');
	papersList.innerHTML = '';

	papers.forEach(paper => {
		const li = document.createElement('li');

		// 生成标题部分
		const h3 = document.createElement('h3');
		const venueTypeText = paper.venueType === '期刊' ? '论文' : '论文';
		const titleText = `${paper.year}年发表${getVenueDescription(paper)}${venueTypeText} (${paper.venueLevel}，${paper.authorPosition})`;
		const span = document.createElement('span');
		span.textContent = titleText;
		h3.appendChild(span);

		// 如果有在线示例链接，添加链接
		if (paper.demoUrl && paper.demoUrlText) {
			const linkSpan = document.createElement('span');
			linkSpan.className = 'link';
			const link = document.createElement('a');
			link.href = paper.demoUrl;
			link.target = '_blank';
			link.textContent = paper.demoUrlText;
			linkSpan.appendChild(link);
			h3.appendChild(linkSpan);
		}

		li.appendChild(h3);

		// 生成内容部分
		const contentUl = document.createElement('ul');
		contentUl.className = 'info-content';

		// 论文引用信息
		const citationLi = document.createElement('li');
		const citationText = formatCitation(paper);
		if (paper.doiUrl) {
			const citationLink = document.createElement('a');
			citationLink.href = paper.doiUrl;
			citationLink.target = '_blank';
			citationLink.innerHTML = `<b>${paper.title}.</b>`;
			citationLi.appendChild(citationLink);
			citationLi.appendChild(document.createTextNode(' ' + citationText));
		} else {
			citationLi.innerHTML = `<b>${paper.title}.</b> ` + citationText;
		}
		contentUl.appendChild(citationLi);

		// 技术栈
		if (paper.techStack) {
			const techLi = document.createElement('li');
			techLi.textContent = '技术栈：' + paper.techStack;
			contentUl.appendChild(techLi);
		}

		// 论文描述
		if (paper.description) {
			const descLi = document.createElement('li');
			descLi.textContent = paper.description;
			contentUl.appendChild(descLi);
		}

		li.appendChild(contentUl);
		papersList.appendChild(li);
	});

	// 同步两个 section 的高度
	syncSectionHeights();

	// 初始化折叠状态：如果内容高度超过400px，默认展开
	setTimeout(() => {
		const container = document.getElementById('papers-container');
		if (container) {
			const actualHeight = container.scrollHeight;
			// 如果实际高度小于等于400px，保持展开状态
			// 如果大于400px，默认展开（不添加collapsed类）
		}
	}, 200);
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

// 获取期刊/会议描述
function getVenueDescription(paper) {
	if (paper.venue.includes('TVCG') || paper.venue.includes('IEEE Transactions on Visualization')) {
		return '可视化领域顶级期刊TVCG';
	} else if (paper.venue.includes('CHI')) {
		return '人机交互领域顶级会议CHI';
	} else if (paper.venue.includes('Visual Informatics')) {
		return 'Visual Informatics';
	} else if (paper.venue.includes('Computational Visual Media')) {
		return 'Computational Visual Media';
	} else if (paper.venue.includes('Journal of Visualization')) {
		return '国内可视化领域顶级会议ChinaVis';
	} else {
		return paper.venue;
	}
}

// 格式化论文引用信息
function formatCitation(paper) {
	let citation = paper.venueFullName;

	// 处理有文章编号的情况（如 CHI 2025 会议论文）
	if (paper.articleNo && paper.pages) {
		citation += ` Article No.: ${paper.articleNo}, Pages ${paper.pages}`;
		if (paper.doi) {
			citation += ` https://doi.org/${paper.doi}`;
		}
		return citation;
	}

	// 处理 CHI 2023 这种格式：venueFullName. year: pages, doi: ...
	if (paper.venue.includes('CHI') && paper.pages && !paper.volume) {
		citation += `. ${paper.year}: ${paper.pages}`;
		if (paper.doi) {
			citation += `, doi: ${paper.doi}`;
		}
		return citation + '.';
	}

	// 处理 TVCG 格式：venueFullName, vol. X, no. Y, pp. Z-Z, Date, doi: ...
	if (paper.venue.includes('TVCG') || paper.venue.includes('IEEE Transactions')) {
		if (paper.volume && paper.issue && paper.pages) {
			citation += `, vol. ${paper.volume}, no. ${paper.issue}, pp. ${paper.pages}`;
		}
		if (paper.publicationDate) {
			citation += `, ${paper.publicationDate}`;
		}
		if (paper.doi) {
			citation += `, doi: ${paper.doi}`;
		}
		return citation + '.';
	}

	// 处理 Visual Informatics 格式：venueFullName. year, volume(issue): pages, doi: ...
	if (paper.venue.includes('Visual Informatics')) {
		if (paper.volume && paper.issue && paper.pages) {
			citation += `. ${paper.year}, ${paper.volume}(${paper.issue}): ${paper.pages}`;
		}
		if (paper.doi) {
			citation += `, doi: ${paper.doi}`;
		}
		return citation + '.';
	}

	// 处理 Computational Visual Media 格式：venueFullName, year, volume(issue): pages, doi: ...
	if (paper.venue.includes('Computational Visual Media')) {
		if (paper.volume && paper.issue && paper.pages) {
			citation += `, ${paper.publicationDate || paper.year}, ${paper.volume}(${paper.issue}): ${paper.pages}`;
		}
		if (paper.doi) {
			citation += `, doi: ${paper.doi}`;
		}
		return citation + '.';
	}

	// 处理 Journal of Visualization 格式：venueFullName, year, volume(issue): pages, doi: ...
	if (paper.venue.includes('Journal of Visualization')) {
		if (paper.volume && paper.issue && paper.pages) {
			citation += `, ${paper.publicationDate || paper.year}, ${paper.volume}(${paper.issue}): ${paper.pages}`;
		}
		if (paper.doi) {
			citation += `, doi: ${paper.doi}`;
		}
		return citation + '.';
	}

	// 处理 Computers & Graphics 格式：venueFullName, volume, pages, Date, doi: ...
	if (paper.venue.includes('Computers & Graphics')) {
		if (paper.volume) {
			citation += `, ${paper.volume}`;
		}
		if (paper.pages) {
			citation += `, ${paper.pages}`;
		}
		if (paper.publicationDate) {
			citation += `, ${paper.publicationDate}`;
		}
		if (paper.doi) {
			citation += `, doi: ${paper.doi}`;
		}
		return citation + '.';
	}

	// 处理待发表论文（有 status 字段）
	if (paper.status) {
		citation += `, ${paper.status} , ${paper.year}`;
		if (paper.doi) {
			citation += `, doi: ${paper.doi}`;
		}
		return citation + '.';
	}

	// 默认格式
	if (paper.doi) {
		citation += `, doi: ${paper.doi}`;
	}
	return citation + '.';
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
