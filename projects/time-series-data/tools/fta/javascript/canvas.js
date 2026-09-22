// check to see if the browser supports
// the addEventListener function
if (window.addEventListener) {
	window.addEventListener
		(
			'load', // this is the load event
			onLoad, // this is the event handler we are going to write
			false   // useCapture boolean value
		);
}

// global variables for the recursive depth function 
//window.maxDepth = 0;
//window.depth = 0;

// the window load event handler
function onLoad() {
	var context, vector, exampleFaultTrees, pan, mousePos, previousMousePos, treeWidth;
	var instructions;

	var canvas = document.getElementById('canvas');

	// setting mouseDown to false initially
	var mouseDown = false;

	// setting the bool for if the instructions screen
	// is up
	var showInstruct = false;

	// setting a bool to toggle between using the dynamicCanvas
	// and fixed states of the canvas
	var dynamicMode = false;

	// setting the initial scale of the canvas
	var scale = 0.8;

	// currentTreeID defines what fault tree is drawn
	// initially and when 1,2,3 is pressed to switch trees
	var currentTreeID = 0;

	var depth = 0;

	// 编辑模式相关变量
	var editMode = false;
	var selectedNode = null;
	var editingNode = null;
	var inputElement = null;
	var lastClickTime = 0;
	var clickThreshold = 300; // 双击时间阈值（毫秒）

	// this function will initialise our variables
	function intialise() {
		// Find the canvas element using its id attribute.
		//canvas = document.getElementById('canvas');
		// if it couldn't be found
		if (!canvas) {
			// make a message box pop up with the error.
			alert('Error: I cannot find the canvas element!');
			return;
		}
		// check if their is a getContext function
		if (!canvas.getContext) {
			// make a message box pop up with the error.
			alert('Error: no canvas.getContext!');
			return;
		}
		// Get the 2D canvas context.
		context = canvas.getContext('2d');
		if (!context) {
			alert('Error: failed to getContext!');
			return;
		}

		// adding the eventlisteners for key presses
		if (window.addEventListener) {
			window.addEventListener('keydown', onKeyDown, false);
		}

		// adding the eventlisteners for mouse movemovents/presses
		if (canvas.addEventListener) {
			canvas.addEventListener('mousedown', onMouseDown, false);
			canvas.addEventListener('mouseup', onMouseUp, false);
			canvas.addEventListener('mousemove', onMouseMove, false);
			canvas.addEventListener('mousewheel', onMouseWheel, false);
			canvas.addEventListener('mouseover', onMouseOver, false);
			canvas.addEventListener('dblclick', onDoubleClick, false);
			canvas.addEventListener('contextmenu', onRightClick, false);
		}

		// creating a new instance of ExampleFaultTrees so it can
		// be used inside the canvas for drawing the fault trees
		exampleFaultTrees = new ExampleFaultTrees();

		// creating an instance of the instructions object
		instructions = new Instructions();

		// creating vectors for pan and previousMousePos, these
		// are used for the panning functionality of the canvas
		pan = new Vector(canvas.width / 2, canvas.height * 0.25);
		previousMousePos = new Vector(event.clientX, event.clientY);
	}

	function onKeyDown(event) {
		var keyCode = event.keyCode; // keyCode is the event used for key presses
		// switch statement used to distinguish actions taken by certain key presses
		switch (keyCode) {
			//switching between fault trees (only in view mode)
			case 49: //1 (not numpad)
				if (!editMode) {
					currentTreeID = 0; // currentTreeID changed to 1, 2nd fault tree
					showInstruct = false;
					clearCanvas();
					resetCanvas(); // scale reset to 0.5
					draw(); // canvas is redrawn to show new tree
				}
				break;

			case 50: //2 (not numpad)
				if (!editMode) {
					currentTreeID = 1; // currentTreeID changed to 1, 2nd fault tree
					showInstruct = false;
					clearCanvas();
					resetCanvas(); // scale reset to 0.5
					draw(); // canvas is redrawn to show new tree
				}
				break;

			case 51: //3 (not numpad)
				if (!editMode) {
					currentTreeID = 2; // currentTreeID changed to 2, 3rd fault tree
					showInstruct = false;
					clearCanvas();
					resetCanvas(); // scale reset to 0.5
					draw(); // canvas is redrawn to show new tree
				}
				break;

			// fits the tree to the size of the canvas
			case 70: // F
				scaleToCanvas();
				break;

			// toggle for switching between dynamic and
			// fixed canvas sizing
			case 68: // D
				if (dynamicMode == false) {
					dynamicMode = true;
				}
				else {
					dynamicMode = false;
				}
				break;

			// 切换编辑模式
			case 69: // E
				editMode = !editMode;
				window.editMode = editMode; // 同步到全局变量
				if (!editMode) {
					clearSelection();
					exitEditMode();
				}
				draw();
				break;

			// 删除选中的节点
			case 46: // Delete
				if (editMode && selectedNode) {
					deleteSelectedNode();
				}
				break;

			// 退出编辑模式
			case 27: // Escape
				if (editMode) {
					exitEditMode();
					clearSelection();
					draw();
				}
				break;
			/*
			case 73: // i 
				drawInstructions();
				break;
			*/
		}
	}

	// when the mouse is called, mouseDown is activated
	function onMouseDown(event) {
		if (showInstruct) {
			mouseDown = false;
		}
		else {
			if (editMode) {
				// 在编辑模式下，检查是否点击了节点
				var clickedNode = getNodeAtPosition(event.clientX, event.clientY);
				if (clickedNode) {
					selectNode(clickedNode);
					mouseDown = false; // 不进行拖拽
				} else {
					clearSelection();
					mouseDown = true; // 允许画布拖拽
				}
			} else {
				mouseDown = true;
			}
		}
	}

	// what happens when the mouse is clicked and dragged
	function onMouseMove(event) {
		mousePos = new Vector(event.clientX, event.clientY);
		if (mouseDown) {
			mousePos.subtract(previousMousePos); // mousePos subtracts the previousMousePos, getting the offset
			pan.add(mousePos); // the values of mousePos are then added to the pan vector
			draw(); // draw is then called to apply panning
		}
		// previousMousePos is then reset back to the current mouse values
		previousMousePos = new Vector(event.clientX, event.clientY);
	}

	// functions used to stop the canvas from panning
	// when not needed
	function onMouseUp(event) {
		mouseDown = false;
	}

	function onMouseOut(event) {
		mouseDown = false;
	}

	function onMouseOver(event) {
		mouseDown = false;
	}

	function onMouseWheel(event) {
		var wheelDelta = event.wheelDelta; // event.wheelDelta is the mouse wheel
		if (wheelDelta > 0) {
			scale = scale + 0.05; // the canvas scale is multiplied by 0.8, making it larger
			//zoomToCursor();
			draw(); // draw is then called to apply the new scale
		}
		else {
			scale = scale - 0.05; // the canvas scale is divided by 0.8, making it smaller
			//zoomToCursor();
			draw(); // draw is then called to apply the new scale				
		}
	}

	// 双击事件处理
	function onDoubleClick(event) {
		if (editMode) {
			var clickedNode = getNodeAtPosition(event.clientX, event.clientY);
			if (clickedNode) {
				startEditingNode(clickedNode);
			} else {
				console.log('\u53cc\u51fb\u4f4d\u7f6e\u6ca1\u6709\u68c0\u6d4b\u5230\u8282\u70b9');
			}
		} else {
			console.log('\u7f16\u8f91\u6a21\u5f0f\u672a\u5f00\u542f\uff0c\u65e0\u6cd5\u53cc\u51fb\u7f16\u8f91');
		}
	}

	// 右键点击事件处理
	function onRightClick(event) {
		event.preventDefault(); // 阻止默认右键菜单
		if (editMode) {
			var clickedNode = getNodeAtPosition(event.clientX, event.clientY);
			if (clickedNode) {
				// 如果点击的是门节点，提供添加子节点的选项
				if (clickedNode.addChild) {
					showNodeContextMenu(event.clientX, event.clientY, clickedNode);
				} else {
					showContextMenu(event.clientX, event.clientY, clickedNode);
				}
			} else {
				showAddNodeMenu(event.clientX, event.clientY);
			}
		}
	}


	/*
	function zoomToCursor() {
		var previousScale = scale;
		
		var A = mousePos.getX() - canvas.width / 3;
		var B = pan.getX() - A;
		var C = B / previousScale;
		var D = C * scale;
		var E = D / 20;
		
		pan.setX(E);
		console.log(pan.getX());
		
		var F = mousePos.getY() - canvas.height / 3;
		var G = pan.getY() - F;
		var H = G / previousScale;
		var I = H * scale;
		var J = I / 20;
		
		pan.setY(J);
		console.log(pan.getY());	
	}
	*/

	// 计算故障树的边界框
	function calculateTreeBounds(node, currentBounds) {
		if (!currentBounds) {
			currentBounds = {
				minX: Infinity,
				maxX: -Infinity,
				minY: Infinity,
				maxY: -Infinity
			};
		}

		if (!node) return currentBounds;

		// 设置当前节点位置
		if (!node.getPosition || (node.getPosition().getX() === 0 && node.getPosition().getY() === 0)) {
			node.setPosition(new Vector(0, 0));
		}

		var pos = node.getPosition();
		var nodeRadius = 50; // 节点半径

		// 更新边界框
		currentBounds.minX = Math.min(currentBounds.minX, pos.getX() - nodeRadius);
		currentBounds.maxX = Math.max(currentBounds.maxX, pos.getX() + nodeRadius);
		currentBounds.minY = Math.min(currentBounds.minY, pos.getY() - nodeRadius);
		currentBounds.maxY = Math.max(currentBounds.maxY, pos.getY() + nodeRadius);

		// 如果是门节点，递归计算子节点
		if (node.numChildren && node.numChildren() > 0) {
			var totalWidth = node.branchWidth();
			var prevChildWidthTotal = 0;

			for (var i = 0; i < node.numChildren(); i++) {
				var child = node.getChild(i);
				var childWidth = child.branchWidth();
				var childX = -totalWidth / 2 + childWidth / 2 + prevChildWidthTotal;
				var childY = 150;

				// 计算子节点的绝对位置
				var absoluteChildX = pos.getX() + childX;
				var absoluteChildY = pos.getY() + childY;

				// 设置子节点的绝对位置
				child.setPosition(new Vector(absoluteChildX, absoluteChildY));

				// 递归计算子节点的边界
				calculateTreeBounds(child, currentBounds);

				prevChildWidthTotal += childWidth;
			}
		}

		return currentBounds;
	}

	// Scaling the canvas according to how many children the fault tree has by accessing
	// the mFaultTree array in exampleFaultTrees (treeWidth is defined in draw)	
	function scaleToCanvas() {
		clearCanvas();
		resetCanvas();

		// 先更新所有节点位置
		var rootNode = exampleFaultTrees.getFaultTree(currentTreeID);
		updateAllNodePositions(rootNode);

		// 计算故障树的边界框
		var bounds = calculateTreeBounds(rootNode);

		// 计算故障树的尺寸
		var treeWidth = bounds.maxX - bounds.minX;
		var treeHeight = bounds.maxY - bounds.minY;

		// 计算画布可用区域（留一些边距）
		var canvasMargin = 50;
		var availableWidth = canvas.width - canvasMargin * 2;
		var availableHeight = canvas.height - canvasMargin * 2;

		// 计算合适的缩放比例
		var scaleX = availableWidth / treeWidth;
		var scaleY = availableHeight / treeHeight;
		scale = Math.min(scaleX, scaleY, 3.0); // 限制最大缩放比例

		// 确保缩放比例不会太小
		if (scale < 0.1) {
			scale = 0.1;
		}

		// 计算居中位置
		var centerX = (bounds.minX + bounds.maxX) / 2;
		var centerY = (bounds.minY + bounds.maxY) / 2;
		pan = new Vector(canvas.width / 2 - centerX * scale, canvas.height * 0.5 - centerY * scale);

		// 调试信息
		console.log('\u6545\u969c\u6811\u8fb9\u754c:', bounds);
		console.log('\u6545\u969c\u6811\u5c3a\u5bf8:', treeWidth, 'x', treeHeight);
		console.log('\u753b\u5e03\u5c3a\u5bf8:', canvas.width, 'x', canvas.height);
		console.log('\u7f29\u653e\u6bd4\u4f8b:', scale);
		console.log('\u5e73\u79fb\u4f4d\u7f6e:', pan.getX(), pan.getY());

		draw();
		drawMinimap();
	}

	window.onresize = function dynamicCanvas() {
		if (dynamicMode == true) {
			clearCanvas();
			resetCanvas();

			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;

			draw();
			drawMinimap();
		}
	}

	// rescaleCanvas is used whenever the canvas scale needs to be
	// reset instead of hard coding it every time
	function resetCanvas() {
		scale = 0.8;
		pan = new Vector(canvas.width / 2, canvas.height * 0.25);
		previousMousePos = new Vector(event.clientX, event.clientY);
	}

	function clearCanvas() {
		context.save();
		//clearing the canvas
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.translate(canvas.width / 2, canvas.height * 0.25);
		context.restore();
	}

	// Removes the browser scroll bars and the canvas margins
	function removePageElements() {
		document.documentElement.style.marginTop = '0';
		document.documentElement.style.marginRight = '0';
		document.documentElement.style.marginLeft = '0';
		document.documentElement.style.marginBottom = '0';
	}

	function drawInstructions() {
		clearCanvas();
		resetCanvas();
		showInstruct = true;

		instructions.draw(context);
	}

	function drawMinimap() {

		context.beginPath();

		context.save();
		context.lineWidth = 5;
		context.translate(canvas.width * 0.84, canvas.height * 0.005);
		context.scale(0.15, 0.15);
		context.fillStyle = '#ffffff';
		context.rect(40, 40, canvas.width, canvas.height);
		context.fill();
		context.stroke();
		context.clip();
		context.translate(canvas.width / 2, canvas.height * 0.3);

		if (currentTreeID == 2) {
			context.translate(pan.getX() - 900, pan.getY() - 375);
		}

		exampleFaultTrees.getFaultTree(currentTreeID).draw(context);


		context.beginPath();

		context.lineWidth = 25;
		context.scale(0.95 / scale, 0.97 / scale);
		context.translate(canvas.width / 50, canvas.height / 25);
		context.strokeStyle = '#ff0000';
		context.translate(-pan.getX(), -pan.getY());
		context.rect(20, 20, canvas.width, canvas.height);
		context.clip();
		context.stroke();
		context.restore();

		/*
		context.save();
		context.font = "15pt Arial";
		context.fillText("Press i for instructions", canvas.width * 0.84, canvas.height * 0.2);
		context.restore();
		*/

	}

	// this function will automatically draw the canvas
	function draw() {
		clearCanvas();

		// Getting the width of the tree and storing it in a variable which can
		// be used in the canvas 
		treeWidth = exampleFaultTrees.mFaultTrees[currentTreeID].numChildren();

		// getting the depth of the tree and storing it in a variable which can
		// be used in the canvas
		//depth = exampleFaultTrees.mFaultTrees[currentTreeID].maxTreeDepth();

		// 在绘制前更新所有节点位置
		updateAllNodePositions(exampleFaultTrees.getFaultTree(currentTreeID));

		context.save();

		// translating the canvas by the pan values
		context.translate(pan.getX(), pan.getY());

		// preventing the canvas from zooming into negative values and from zooming
		// in too far as well 
		if (scale <= 0) {
			scale = 0.05;
		}
		if (scale >= 3.2) {
			scale = 3.15;
		}

		// scaling the canvas according to the zooming function
		context.scale(scale, scale);

		// draws whatever fault tree currentTreeID is set to (0,1,2),
		// the default is always 0, the first fault tree
		exampleFaultTrees.getFaultTree(currentTreeID).draw(context);

		context.restore();

		removePageElements();
		drawMinimap();
	}

	// 获取指定位置的节点
	function getNodeAtPosition(x, y) {
		try {
			// 将屏幕坐标转换为画布坐标
			var canvasRect = canvas.getBoundingClientRect();
			var canvasX = x - canvasRect.left;
			var canvasY = y - canvasRect.top;

			// 转换为故障树坐标系
			// 绘制时的变换顺序：
			// 1. translate(pan.getX(), pan.getY()) - 平移
			// 2. scale(scale, scale) - 缩放
			// 所以反向变换应该是：
			// 1. 除以缩放
			// 2. 减去平移
			var treeX = (canvasX - pan.getX()) / scale;
			var treeY = (canvasY - pan.getY()) / scale;

			var point = new Vector(treeX, treeY);

			return findNodeAtPoint(exampleFaultTrees.getFaultTree(currentTreeID), point);
		} catch (error) {
			console.error('getNodeAtPosition\u9519\u8bef:', error);
			return null;
		}
	}

	// 递归查找指定点的节点
	function findNodeAtPoint(node, point) {
		// 设置当前节点位置（根节点在原点）
		if (!node.getPosition || (node.getPosition().getX() === 0 && node.getPosition().getY() === 0)) {
			node.setPosition(new Vector(0, 0));
		}

		// 检查当前节点
		if (node.isPointInside(point, context)) {
			return node;
		}

		// 如果是门节点，检查子节点
		if (node.numChildren && node.numChildren() > 0) {
			var totalWidth = node.branchWidth();
			var prevChildWidthTotal = 0;

			for (var i = 0; i < node.numChildren(); i++) {
				var child = node.getChild(i);
				var childWidth = child.branchWidth();
				var childX = -totalWidth / 2 + childWidth / 2 + prevChildWidthTotal;
				var childY = 150;

				// 计算子节点的绝对位置
				var absoluteChildX = node.getPosition().getX() + childX;
				var absoluteChildY = node.getPosition().getY() + childY;

				// 设置子节点的绝对位置
				child.setPosition(new Vector(absoluteChildX, absoluteChildY));

				// 检查子节点（使用绝对坐标）
				if (child.isPointInside(point, context)) {
					return child;
				}

				// 递归检查子节点的子节点（使用绝对坐标）
				var foundNode = findNodeAtPoint(child, point);
				if (foundNode) {
					return foundNode;
				}

				prevChildWidthTotal += childWidth;
			}
		}

		return null;
	}

	// 选择节点
	function selectNode(node) {
		clearSelection();
		selectedNode = node;
		node.setSelected(true);
		draw();
	}

	// 清除选择
	function clearSelection() {
		if (selectedNode) {
			selectedNode.setSelected(false);
			selectedNode = null;
		}
	}

	// 开始编辑节点
	function startEditingNode(node) {
		exitEditMode();
		editingNode = node;
		node.setEditing(true);

		// 创建输入框
		createInputElement(node);
		draw();
	}

	// 退出编辑模式
	function exitEditMode() {
		if (editingNode) {
			editingNode.setEditing(false);
			editingNode = null;
		}
		if (inputElement) {
			inputElement.remove();
			inputElement = null;
		}
	}

	// 创建输入框元素
	function createInputElement(node) {
		inputElement = document.createElement('input');
		inputElement.type = 'text';
		inputElement.value = node.getText();
		inputElement.style.position = 'absolute';
		inputElement.style.border = '2px solid #ff0000';
		inputElement.style.fontSize = '14px';
		inputElement.style.padding = '2px';
		inputElement.style.zIndex = '1000';

		// 计算输入框位置（考虑画布变换）
		var canvasRect = canvas.getBoundingClientRect();
		var nodeX = (node.getPosition().getX() * scale) + pan.getX();
		var nodeY = (node.getPosition().getY() * scale) + pan.getY();

		inputElement.style.left = (canvasRect.left + nodeX - 50) + 'px';
		inputElement.style.top = (canvasRect.top + nodeY - 20) + 'px';
		inputElement.style.width = '100px';

		document.body.appendChild(inputElement);
		inputElement.focus();
		inputElement.select();

		// 添加事件监听
		inputElement.addEventListener('blur', function () {
			saveNodeText();
		});

		inputElement.addEventListener('keydown', function (event) {
			if (event.keyCode === 13) { // Enter
				saveNodeText();
			} else if (event.keyCode === 27) { // Escape
				cancelEdit();
			}
		});
	}

	// 保存节点文本
	function saveNodeText() {
		if (editingNode && inputElement) {
			editingNode.setText(inputElement.value);
			exitEditMode();
			draw();
		}
	}

	// 取消编辑
	function cancelEdit() {
		exitEditMode();
		draw();
	}

	// 删除选中的节点
	function deleteSelectedNode() {
		if (selectedNode && confirm('\u786e\u5b9a\u8981\u5220\u9664\u8fd9\u4e2a\u8282\u70b9\u5417\uff1f')) {
			var rootNode = exampleFaultTrees.getFaultTree(currentTreeID);
			var parentNode = exampleFaultTrees.findParentNode(rootNode, selectedNode);

			if (parentNode) {
				exampleFaultTrees.removeNodeFromParent(parentNode, selectedNode);
				clearSelection();
				draw();
			} else {
				alert('\u65e0\u6cd5\u5220\u9664\u6839\u8282\u70b9');
			}
		}
	}

	// 显示节点上下文菜单（用于门节点）
	function showNodeContextMenu(x, y, node) {
		var action = prompt('\u9009\u62e9\u64cd\u4f5c:\n1. \u7f16\u8f91\u6587\u672c\n2. \u5220\u9664\u8282\u70b9\n3. \u6dfb\u52a0\u5b50\u8282\u70b9\n\u8bf7\u8f93\u5165\u6570\u5b57:', '1');
		if (action === '1') {
			startEditingNode(node);
		} else if (action === '2') {
			deleteSelectedNode();
		} else if (action === '3') {
			showAddChildNodeMenu(x, y, node);
		}
	}

	// 显示上下文菜单（用于基本事件和转移门）
	function showContextMenu(x, y, node) {
		// 简单的确认对话框替代右键菜单
		var action = prompt('\u9009\u62e9\u64cd\u4f5c:\n1. \u7f16\u8f91\u6587\u672c\n2. \u5220\u9664\u8282\u70b9\n\u8bf7\u8f93\u5165\u6570\u5b57:', '1');
		if (action === '1') {
			startEditingNode(node);
		} else if (action === '2') {
			deleteSelectedNode();
		}
	}

	// 显示添加子节点菜单（直接添加到指定父节点）
	function showAddChildNodeMenu(x, y, parentNode) {
		var nodeType = prompt('\u9009\u62e9\u8981\u6dfb\u52a0\u7684\u8282\u70b9\u7c7b\u578b:\n1. \u57fa\u672c\u4e8b\u4ef6\n2. \u4e0e\u95e8\n3. \u6216\u95e8\n4. \u8f6c\u79fb\u95e8\n\u8bf7\u8f93\u5165\u6570\u5b57:', '1');
		if (nodeType) {
			var newNode = createNodeByType(nodeType);
			if (newNode) {
				// 添加到指定的父节点
				exampleFaultTrees.addNodeToParent(parentNode, newNode);
				// 重新计算所有节点位置
				updateAllNodePositions(exampleFaultTrees.getFaultTree(currentTreeID));
				draw();
			}
		}
	}

	// 显示添加节点菜单
	function showAddNodeMenu(x, y) {
		// 首先尝试找到点击位置附近的父节点
		var targetParent = findNearestParentNode(x, y);

		if (!targetParent) {
			// 如果没有找到合适的父节点，让用户选择
			var parentChoice = prompt('\u9009\u62e9\u8981\u6dfb\u52a0\u5230\u7684\u7236\u8282\u70b9:\n1. \u6839\u8282\u70b9\n2. \u9009\u62e9\u73b0\u6709\u8282\u70b9\n\u8bf7\u8f93\u5165\u6570\u5b57:', '1');
			if (parentChoice === '1') {
				targetParent = exampleFaultTrees.getFaultTree(currentTreeID);
			} else if (parentChoice === '2') {
				// 让用户点击选择父节点
				alert('\u8bf7\u5148\u70b9\u51fb\u8981\u6dfb\u52a0\u5b50\u8282\u70b9\u7684\u7236\u8282\u70b9\uff0c\u7136\u540e\u518d\u6b21\u53f3\u952e\u6dfb\u52a0\u65b0\u8282\u70b9');
				return;
			} else {
				return;
			}
		}

		// 检查父节点是否支持子节点
		if (!targetParent.addChild) {
			alert('\u9009\u4e2d\u7684\u8282\u70b9\u4e0d\u652f\u6301\u6dfb\u52a0\u5b50\u8282\u70b9\uff08\u57fa\u672c\u4e8b\u4ef6\u548c\u8f6c\u79fb\u95e8\u4e0d\u80fd\u6dfb\u52a0\u5b50\u8282\u70b9\uff09');
			return;
		}

		var nodeType = prompt('\u9009\u62e9\u8981\u6dfb\u52a0\u7684\u8282\u70b9\u7c7b\u578b:\n1. \u57fa\u672c\u4e8b\u4ef6\n2. \u4e0e\u95e8\n3. \u6216\u95e8\n4. \u8f6c\u79fb\u95e8\n\u8bf7\u8f93\u5165\u6570\u5b57:', '1');
		if (nodeType) {
			var newNode = createNodeByType(nodeType);
			if (newNode) {
				// 添加到选中的父节点
				exampleFaultTrees.addNodeToParent(targetParent, newNode);
				// 重新计算所有节点位置
				updateAllNodePositions(exampleFaultTrees.getFaultTree(currentTreeID));
				draw();
			}
		}
	}

	// 查找最近的父节点
	function findNearestParentNode(x, y) {
		var canvasRect = canvas.getBoundingClientRect();
		var canvasX = x - canvasRect.left;
		var canvasY = y - canvasRect.top;

		// 转换为故障树坐标系
		var treeX = (canvasX - pan.getX()) / scale;
		var treeY = (canvasY - pan.getY()) / scale;

		var point = new Vector(treeX, treeY);
		var rootNode = exampleFaultTrees.getFaultTree(currentTreeID);

		// 查找最近的可以添加子节点的节点
		return findNearestParentNodeRecursive(rootNode, point, null);
	}

	// 递归查找最近的父节点
	function findNearestParentNodeRecursive(node, point, bestParent) {
		// 设置当前节点位置
		if (!node.getPosition || (node.getPosition().getX() === 0 && node.getPosition().getY() === 0)) {
			node.setPosition(new Vector(0, 0));
		}

		// 检查当前节点是否支持子节点
		if (node.addChild && node.isPointInside && node.isPointInside(point, context)) {
			bestParent = node;
		}

		// 如果是门节点，检查子节点
		if (node.numChildren && node.numChildren() > 0) {
			var totalWidth = node.branchWidth();
			var prevChildWidthTotal = 0;

			for (var i = 0; i < node.numChildren(); i++) {
				var child = node.getChild(i);
				var childWidth = child.branchWidth();
				var childX = -totalWidth / 2 + childWidth / 2 + prevChildWidthTotal;
				var childY = 150;

				// 计算子节点的绝对位置
				var absoluteChildX = node.getPosition().getX() + childX;
				var absoluteChildY = node.getPosition().getY() + childY;

				// 设置子节点的绝对位置
				child.setPosition(new Vector(absoluteChildX, absoluteChildY));

				// 递归检查子节点
				bestParent = findNearestParentNodeRecursive(child, point, bestParent);

				prevChildWidthTotal += childWidth;
			}
		}

		return bestParent;
	}

	// 更新所有节点位置
	function updateAllNodePositions(node) {
		if (!node) return;

		// 设置根节点位置
		if (!node.getPosition || (node.getPosition().getX() === 0 && node.getPosition().getY() === 0)) {
			node.setPosition(new Vector(0, 0));
		}

		// 如果是门节点，更新子节点位置
		if (node.numChildren && node.numChildren() > 0) {
			var totalWidth = node.branchWidth();
			var prevChildWidthTotal = 0;

			for (var i = 0; i < node.numChildren(); i++) {
				var child = node.getChild(i);
				var childWidth = child.branchWidth();
				var childX = -totalWidth / 2 + childWidth / 2 + prevChildWidthTotal;
				var childY = 150;

				// 计算子节点的绝对位置
				var absoluteChildX = node.getPosition().getX() + childX;
				var absoluteChildY = node.getPosition().getY() + childY;

				// 设置子节点的绝对位置
				child.setPosition(new Vector(absoluteChildX, absoluteChildY));

				// 递归更新子节点的子节点
				updateAllNodePositions(child);

				prevChildWidthTotal += childWidth;
			}
		}
	}

	// 根据类型创建节点
	function createNodeByType(nodeType) {
		switch (nodeType) {
			case '1':
				return new BasicEvent();
			case '2':
				return new AndGate();
			case '3':
				return new OrGate();
			case '4':
				return new TransferGate();
			default:
				return null;
		}
	}

	// call the initialise and draw functions
	intialise();
	draw();

	// 将关键变量暴露到全局作用域（在初始化之后）
	window.exampleFaultTrees = exampleFaultTrees;
	window.currentTreeID = currentTreeID;
	window.clearSelection = clearSelection;
	window.draw = draw;
	window.editMode = editMode;
	window.getNodeAtPosition = getNodeAtPosition;

	// 暴露编辑模式切换函数
	window.toggleEditModeInternal = function () {
		editMode = !editMode;
		window.editMode = editMode; // 同步到全局变量
		if (!editMode) {
			clearSelection();
			exitEditMode();
		}
		draw();
	};

}