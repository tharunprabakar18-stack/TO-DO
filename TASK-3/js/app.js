/* ==========================================================================
   DO TASKS - APP ENGINE (VANILLA JAVASCRIPT STATE MANAGER)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  // --- 1. STATE CONFIGURATION & DATA SCHEMA ---
  let state = {
    tasks: [],
    tempSubtasks: [], // Holds subtasks currently being added in form
    filters: {
      status: 'all',     // 'all' | 'active' | 'completed'
      category: 'all',   // 'all' | specific category string
      searchQuery: '',   // Live search text
      sortBy: 'created-desc' // 'created-desc' | 'created-asc' | 'due-asc' | 'due-desc' | 'priority-desc' | 'alphabetical-asc'
    },
    recentlyDeleted: null // Ref for Undo: { task: Object, index: Number }
  };

  // Default tasks to populate if localStorage is empty
  const defaultTasks = [
    {
      id: 'task-default-1',
      title: 'Design Do Tasks spatial landing page',
      description: 'Create a frosted glass layout, configure keyframe animations, and design custom glowing checklist checkboxes.',
      dueDate: getFutureDateString(1),
      dueTime: '17:00',
      priority: 'high',
      category: 'Work',
      completed: false,
      subtasks: [
        { id: 'sub-def-1-1', title: 'Define custom HSL color palette variables', completed: true },
        { id: 'sub-def-1-2', title: 'Create blur mesh backgrounds', completed: true },
        { id: 'sub-def-1-3', title: 'Code slide-out animation transitions', completed: false }
      ],
      createdAt: Date.now() - 1000 * 60 * 60 * 2 // 2 hours ago
    },
    {
      id: 'task-default-2',
      title: 'Review weekly subscription budget',
      description: 'Audit recurring bills, optimize unused SaaS platforms, and log updates inside the finance ledger.',
      dueDate: getFutureDateString(3),
      dueTime: '12:00',
      priority: 'medium',
      category: 'Finance',
      completed: false,
      subtasks: [
        { id: 'sub-def-2-1', title: 'Download statements from bank portal', completed: false }
      ],
      createdAt: Date.now() - 1000 * 60 * 60 * 24 // 1 day ago
    },
    {
      id: 'task-default-3',
      title: 'Plan grocery haul for meal prep',
      description: 'High-protein diet groceries including salmon, avocado, broccoli, and spinach.',
      dueDate: getFutureDateString(-1), // Overdue task example
      dueTime: '09:00',
      priority: 'low',
      category: 'Shopping',
      completed: true,
      subtasks: [],
      createdAt: Date.now() - 1000 * 60 * 60 * 48 // 2 days ago
    }
  ];

  // Helper to generate dynamic relative dates for default items
  function getFutureDateString(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  // --- 2. DOM ELEMENT SELECTORS ---
  const elements = {
    // Header Widget Elements
    currentDate: document.getElementById('current-date'),
    currentTime: document.getElementById('current-time'),
    themeToggle: document.getElementById('theme-toggle'),
    summaryRingFill: document.getElementById('summary-ring-fill'),
    summaryPercentage: document.getElementById('summary-percentage'),
    summaryFraction: document.getElementById('summary-fraction'),

    // Task Creation Form Elements
    creationForm: document.getElementById('task-creation-form'),
    taskTitle: document.getElementById('task-title'),
    taskDesc: document.getElementById('task-desc'),
    taskCategory: document.getElementById('task-category'),
    taskPriority: document.getElementById('task-priority'),
    taskDueDate: document.getElementById('task-due-date'),
    taskDueTime: document.getElementById('task-due-time'),
    tempSubtaskInput: document.getElementById('temp-subtask-input'),
    btnAddTempSubtask: document.getElementById('btn-add-temp-subtask'),
    tempSubtasksList: document.getElementById('temp-subtasks-list'),
    btnSubmitTask: document.getElementById('btn-submit-task'),

    // Filtering, Searching, & Sorting Elements
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    statusTabs: document.querySelectorAll('.filter-tab'),
    sortSelect: document.getElementById('sort-select'),
    categoryPills: document.getElementById('category-pills'),

    // Task Feed Container
    taskList: document.getElementById('task-list'),
    emptyStatePlaceholder: document.getElementById('empty-state-placeholder'),

    // Footer Overview Stats
    statsTotal: document.getElementById('stats-total'),
    statsActive: document.getElementById('stats-active'),
    statsCompleted: document.getElementById('stats-completed'),
    btnClearCompleted: document.getElementById('btn-clear-completed'),

    // Edit Task Dialog Modal Elements
    editModal: document.getElementById('edit-task-modal'),
    editForm: document.getElementById('edit-task-form'),
    editId: document.getElementById('edit-task-id'),
    editTitle: document.getElementById('edit-task-title'),
    editDesc: document.getElementById('edit-task-desc'),
    editCategory: document.getElementById('edit-task-category'),
    editPriority: document.getElementById('edit-task-priority'),
    editDueDate: document.getElementById('edit-task-due-date'),
    editDueTime: document.getElementById('edit-task-due-time'),
    btnCancelEdit: document.getElementById('btn-cancel-edit'),
    btnCloseModal: document.getElementById('btn-close-modal'),

    // Toast Messages Container
    toastContainer: document.getElementById('toast-container')
  };

  // --- 3. INIT & LOCAL STORAGE SYNC ---
  function init() {
    // 0. Load theme from storage
    const storedTheme = localStorage.getItem('theme') || 'dark';
    if (storedTheme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }

    // 1. Sync Clock immediately and begin interval
    updateClock();
    setInterval(updateClock, 1000);

    // 2. Load Tasks from localStorage or populate defaults
    const stored = localStorage.getItem('aether_tasks');
    if (stored) {
      try {
        state.tasks = JSON.parse(stored);
      } catch (err) {
        console.error("Error reading localStorage, resetting task board.", err);
        state.tasks = [...defaultTasks];
      }
    } else {
      state.tasks = [...defaultTasks];
      saveToStorage();
    }

    // 3. Render initial category pills, tasks and metrics
    renderCategoryFilters();
    renderTasks();
    
    // 4. Setup Event Listeners
    setupEventHandlers();
  }

  function saveToStorage() {
    localStorage.setItem('aether_tasks', JSON.stringify(state.tasks));
  }

  // --- 4. REAL-TIME CLOCK ENGINE ---
  function updateClock() {
    const now = new Date();
    
    // Weekday, Month Day formatting
    const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    elements.currentDate.textContent = now.toLocaleDateString('en-US', dateOptions);
    
    // Hour:Minute AM/PM formatting
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // conversion of 0 to 12
    const strTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    elements.currentTime.textContent = strTime;
  }

  // --- 5. PROGRESS METRIC CALCULATOR ---
  function updateGlobalMetrics() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const active = total - completed;

    // Update bottom footer counter stats
    elements.statsTotal.textContent = total;
    elements.statsActive.textContent = active;
    elements.statsCompleted.textContent = completed;

    // Calculate percentage and update the visual ring svg
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    elements.summaryPercentage.textContent = `${percentage}%`;
    elements.summaryFraction.textContent = `${completed}/${total} Tasks`;

    // Visual ring dashboard offset math
    // Stroke-dasharray of circle = 2 * PI * r = 2 * 3.14159 * 24 ≈ 150.79
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    elements.summaryRingFill.style.strokeDashoffset = offset;
  }

  // --- 6. UTILITY HELPER METHODS ---
  function generateId() {
    return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
  }

  function formatDateFriendly(dateStr, timeStr) {
    if (!dateStr) return '';
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const targetDate = new Date(dateStr + 'T00:00:00');
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let formatted = '';
    let isOverdue = false;

    if (diffDays === 0) {
      formatted = 'Today';
    } else if (diffDays === 1) {
      formatted = 'Tomorrow';
    } else if (diffDays === -1) {
      formatted = 'Yesterday';
      isOverdue = true;
    } else if (diffDays < -1) {
      formatted = `${Math.abs(diffDays)} days ago`;
      isOverdue = true;
    } else {
      // e.g. "Jul 25, 2026"
      const opt = { month: 'short', day: 'numeric', year: 'numeric' };
      formatted = targetDate.toLocaleDateString('en-US', opt);
    }

    if (timeStr) {
      // Format 24h to 12h representation for layout
      const [h, m] = timeStr.split(':');
      let hourNum = parseInt(h);
      const suffix = hourNum >= 12 ? 'PM' : 'AM';
      hourNum = hourNum % 12 || 12;
      formatted += ` at ${String(hourNum).padStart(2, '0')}:${m} ${suffix}`;
    }

    return { text: formatted, overdue: isOverdue };
  }

  // --- 7. CATEGORY PILLS MANAGER ---
  function renderCategoryFilters() {
    // Get unique categories from the default lists & added state
    const categories = new Set(['All']);
    state.tasks.forEach(t => {
      if (t.category) categories.add(t.category);
    });

    elements.categoryPills.innerHTML = '';
    categories.forEach(cat => {
      const button = document.createElement('button');
      button.className = `category-pill ${state.filters.category === cat.toLowerCase() || (cat === 'All' && state.filters.category === 'all') ? 'active' : ''}`;
      button.textContent = cat;
      button.dataset.category = cat.toLowerCase();
      elements.categoryPills.appendChild(button);
    });
  }

  // --- 8. STATE-TO-DOM RENDER ENGINE ---
  function renderTasks() {
    // 1. Calculate stats metrics
    updateGlobalMetrics();

    // 2. Filter tasks based on search, status, and category
    let filteredTasks = state.tasks.filter(task => {
      // A. Status Filter
      if (state.filters.status === 'active' && task.completed) return false;
      if (state.filters.status === 'completed' && !task.completed) return false;

      // B. Category Filter
      if (state.filters.category !== 'all') {
        if (!task.category || task.category.toLowerCase() !== state.filters.category) return false;
      }

      // C. Live Text Search Filter (Title, Description, Category)
      if (state.filters.searchQuery) {
        const query = state.filters.searchQuery.toLowerCase();
        const inTitle = task.title.toLowerCase().includes(query);
        const inDesc = task.description ? task.description.toLowerCase().includes(query) : false;
        const inCat = task.category ? task.category.toLowerCase().includes(query) : false;
        if (!inTitle && !inDesc && !inCat) return false;
      }

      return true;
    });

    // 3. Sort tasks
    filteredTasks.sort((a, b) => {
      switch (state.filters.sortBy) {
        case 'created-asc':
          return a.createdAt - b.createdAt;
        
        case 'created-desc':
          return b.createdAt - a.createdAt;

        case 'due-asc':
          // Push tasks without due dates to the end
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          const aDateTime = new Date(`${a.dueDate}T${a.dueTime || '23:59:59'}`);
          const bDateTime = new Date(`${b.dueDate}T${b.dueTime || '23:59:59'}`);
          return aDateTime - bDateTime;

        case 'due-desc':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          const aDateTime2 = new Date(`${a.dueDate}T${a.dueTime || '23:59:59'}`);
          const bDateTime2 = new Date(`${b.dueDate}T${b.dueTime || '23:59:59'}`);
          return bDateTime2 - aDateTime2;

        case 'priority-desc':
          const priorityWeight = { high: 3, medium: 2, low: 1 };
          return priorityWeight[b.priority] - priorityWeight[a.priority];

        case 'alphabetical-asc':
          return a.title.localeCompare(b.title);

        default:
          return b.createdAt - a.createdAt;
      }
    });

    // 4. Render Layout
    const taskContainer = elements.taskList;
    
    // Clear dynamic cards (preserving the empty state placeholder markup)
    const cards = taskContainer.querySelectorAll('.task-card');
    cards.forEach(card => card.remove());

    if (filteredTasks.length === 0) {
      elements.emptyStatePlaceholder.style.display = 'flex';
      return;
    }

    elements.emptyStatePlaceholder.style.display = 'none';

    filteredTasks.forEach(task => {
      const card = createTaskCardDOM(task);
      taskContainer.appendChild(card);
    });
  }

  // Create task card element dynamically
  function createTaskCardDOM(task) {
    const card = document.createElement('div');
    card.className = `task-card ${task.completed ? 'completed' : ''}`;
    card.dataset.id = task.id;
    card.dataset.priority = task.priority;

    // Subtask progress stats
    const totalSub = task.subtasks ? task.subtasks.length : 0;
    const completedSub = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
    const subPct = totalSub > 0 ? Math.round((completedSub / totalSub) * 100) : 0;

    // Friendly date calculation
    let dateHtml = '';
    if (task.dueDate) {
      const dateInfo = formatDateFriendly(task.dueDate, task.dueTime);
      const overdueClass = (dateInfo.overdue && !task.completed) ? 'overdue' : '';
      
      dateHtml = `
        <div class="task-meta-item ${overdueClass}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>${dateInfo.text}</span>
          ${(dateInfo.overdue && !task.completed) ? '<span class="overdue-tag">(Overdue)</span>' : ''}
        </div>
      `;
    }

    // Build the inner subtask items checklist if subtasks exist
    let subtasksHtml = '';
    if (totalSub > 0) {
      const subItemsMarkup = task.subtasks.map(sub => `
        <li class="card-subtask-item" data-sub-id="${sub.id}">
          <label class="subtask-checkbox-container">
            <input type="checkbox" class="subtask-toggle" ${sub.completed ? 'checked' : ''}>
            <span class="subtask-checkmark"></span>
            <span class="card-subtask-text">${sub.title}</span>
          </label>
        </li>
      `).join('');

      subtasksHtml = `
        <div class="task-subtasks-section">
          <div class="subtasks-header" aria-expanded="true">
            <span class="subtasks-title">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
              </svg>
              <span>Subtasks Checklist</span>
            </span>
            <span class="subtasks-stats">${completedSub}/${totalSub} (${subPct}%)</span>
          </div>
          <div class="subtasks-progress-wrapper">
            <div class="subtasks-progress-bar">
              <div class="subtasks-progress-fill" style="width: ${subPct}%"></div>
            </div>
          </div>
          <ul class="card-subtasks-list">
            ${subItemsMarkup}
          </ul>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="task-main-row">
        <!-- Complete Checkbox -->
        <label class="checkbox-container" aria-label="Toggle completed status for ${task.title}">
          <input type="checkbox" class="task-complete-checkbox" ${task.completed ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>

        <!-- Title, Category, Description -->
        <div class="task-info-content">
          <div class="task-title-line">
            <h3 class="task-card-title">${task.title}</h3>
            ${task.category ? `<span class="task-card-category">${task.category}</span>` : ''}
            <span class="task-priority-badge badge-${task.priority}">${task.priority}</span>
          </div>
          
          ${task.description ? `<p class="task-card-desc">${task.description}</p>` : ''}
          
          <div class="task-meta-details">
            ${dateHtml}
            <div class="task-meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Added ${formatTimeAgo(task.createdAt)}</span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="task-actions">
          <button class="btn-card-action btn-edit" aria-label="Edit task details">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button class="btn-card-action btn-delete" aria-label="Delete task from board">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Subtasks wrapper -->
      ${subtasksHtml}
    `;

    return card;
  }

  // Helper formatting for "Added x mins ago"
  function formatTimeAgo(timestamp) {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);

    if (diffSec < 60) {
      return 'just now';
    } else if (diffMin < 60) {
      return `${diffMin}m ago`;
    } else if (diffHour < 24) {
      return `${diffHour}h ago`;
    } else {
      const diffDays = Math.round(diffHour / 24);
      return `${diffDays}d ago`;
    }
  }

  // --- 9. CRUD EVENT DELEGATOR HANDLERS ---
  
  // A. Create Task
  function handleTaskFormSubmit(e) {
    e.preventDefault();

    const title = elements.taskTitle.value.trim();
    if (!title) return;

    const description = elements.taskDesc.value.trim();
    const category = elements.taskCategory.value;
    const priority = elements.taskPriority.value;
    const dueDate = elements.taskDueDate.value;
    const dueTime = elements.taskDueTime.value;

    const newTask = {
      id: generateId(),
      title,
      description,
      dueDate,
      dueTime,
      priority,
      category,
      completed: false,
      subtasks: [...state.tempSubtasks],
      createdAt: Date.now()
    };

    // Append task, clear form state
    state.tasks.push(newTask);
    saveToStorage();

    // Reset Creation form fields
    elements.creationForm.reset();
    state.tempSubtasks = [];
    elements.tempSubtasksList.innerHTML = '';

    // Re-render UI
    renderCategoryFilters();
    renderTasks();
    showToast("Task created successfully!");
  }

  // Add temporary subtask text representation inside the creation form
  function addTempSubtask() {
    const text = elements.tempSubtaskInput.value.trim();
    if (!text) return;

    const sub = {
      id: generateId(),
      title: text,
      completed: false
    };

    state.tempSubtasks.push(sub);
    elements.tempSubtaskInput.value = '';

    // Render it locally in form checklist
    const li = document.createElement('li');
    li.className = 'temp-subtask-item';
    li.dataset.tempId = sub.id;
    li.innerHTML = `
      <span>${sub.title}</span>
      <button type="button" class="btn-remove-temp" aria-label="Remove step">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    `;
    elements.tempSubtasksList.appendChild(li);
  }

  // Remove temporary subtask
  function removeTempSubtask(liElement) {
    const id = liElement.dataset.tempId;
    state.tempSubtasks = state.tempSubtasks.filter(s => s.id !== id);
    liElement.remove();
  }

  // B. Toggle main task checkbox complete status
  function toggleTaskCompletion(taskId, isChecked) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = isChecked;
    
    // Auto-update all subtasks complete status when toggling the main task
    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks.forEach(sub => {
        sub.completed = isChecked;
      });
    }

    saveToStorage();
    renderTasks();
  }

  // C. Toggle single subtask status inside task card
  function toggleSubtaskCompletion(taskId, subId, isChecked) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const sub = task.subtasks.find(s => s.id === subId);
    if (!sub) return;

    sub.completed = isChecked;

    // Optional premium feel: Auto-check main task if all subtasks are complete
    const allChecked = task.subtasks.every(s => s.completed);
    if (allChecked) {
      task.completed = true;
    } else {
      // If some subtask became active, the main task can optionally become active
      if (!isChecked) {
        task.completed = false;
      }
    }

    saveToStorage();
    renderTasks();
  }

  // D. Delete Task (Includes Exit Slide Animations & Undo System)
  function deleteTask(taskId) {
    const index = state.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return;

    const card = document.querySelector(`.task-card[data-id="${taskId}"]`);
    
    // Trigger smooth exit transition prior to list slice
    if (card) {
      card.classList.add('card-exit');
      
      // Delay state removal until keyframe slide finishes
      setTimeout(() => {
        executeDelete(index);
      }, 300);
    } else {
      executeDelete(index);
    }
  }

  function executeDelete(index) {
    const deletedTask = state.tasks[index];
    
    // Store reference in recentlyDeleted for Undo trigger
    state.recentlyDeleted = {
      task: deletedTask,
      index: index
    };

    state.tasks.splice(index, 1);
    saveToStorage();
    
    renderCategoryFilters();
    renderTasks();

    // Spawn popup notification with "Undo" action
    showToast(`Deleted task: "${deletedTask.title}"`, true);
  }

  // Undo delete execution
  function triggerUndoDelete() {
    if (!state.recentlyDeleted) return;

    const { task, index } = state.recentlyDeleted;
    
    // Put back at original indices position
    state.tasks.splice(index, 0, task);
    state.recentlyDeleted = null;

    saveToStorage();
    
    renderCategoryFilters();
    renderTasks();
    showToast("Task restored!");
  }

  // E. Edit Task Modal Controller
  function openEditModal(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Fill dialog form references
    elements.editId.value = task.id;
    elements.editTitle.value = task.title;
    elements.editDesc.value = task.description || '';
    elements.editCategory.value = task.category || 'Work';
    elements.editPriority.value = task.priority;
    elements.editDueDate.value = task.dueDate || '';
    elements.editDueTime.value = task.dueTime || '';

    // Open native dialog modal overlay
    elements.editModal.showModal();
  }

  function handleEditFormSubmit(e) {
    e.preventDefault();

    const id = elements.editId.value;
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    // Update details
    task.title = elements.editTitle.value.trim();
    task.description = elements.editDesc.value.trim();
    task.category = elements.editCategory.value;
    task.priority = elements.editPriority.value;
    task.dueDate = elements.editDueDate.value;
    task.dueTime = elements.editDueTime.value;

    saveToStorage();
    elements.editModal.close();
    
    renderCategoryFilters();
    renderTasks();
    showToast("Changes saved successfully!");
  }

  // Clear completed tasks
  function clearCompletedTasks() {
    const completedCount = state.tasks.filter(t => t.completed).length;
    if (completedCount === 0) {
      showToast("No completed tasks to clear.");
      return;
    }

    state.tasks = state.tasks.filter(t => !t.completed);
    saveToStorage();
    
    renderCategoryFilters();
    renderTasks();
    showToast(`Cleared ${completedCount} completed task(s)`);
  }

  // --- 10. TOAST ENGINE ---
  function showToast(msg, includeUndo = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let undoMarkup = '';
    if (includeUndo) {
      undoMarkup = `<button type="button" class="toast-undo-btn">Undo</button>`;
    }

    toast.innerHTML = `
      <span class="toast-msg">${msg}</span>
      ${undoMarkup}
    `;

    // Undo action trigger
    if (includeUndo) {
      const undoBtn = toast.querySelector('.toast-undo-btn');
      undoBtn.addEventListener('click', () => {
        triggerUndoDelete();
        // Remove toast card instantly on trigger
        toast.remove();
      });
    }

    elements.toastContainer.appendChild(toast);

    // Auto-destruct timer (6s duration)
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'toastExit 0.25s cubic-bezier(0.55, 0.085, 0.68, 0.53) both';
        toast.addEventListener('animationend', () => {
          toast.remove();
        });
      }
    }, 5750);
  }

  // --- 11. CENTRALIZED INTERACTION DELEGATORS ---
  function setupEventHandlers() {
    
    // Creation Form submission
    elements.creationForm.addEventListener('submit', handleTaskFormSubmit);

    // Temp subtask addition click & enter key
    elements.btnAddTempSubtask.addEventListener('click', addTempSubtask);
    elements.tempSubtaskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Stop creation form from submitting
        addTempSubtask();
      }
    });

    // Temp subtask checklist clicks (remove step button)
    elements.tempSubtasksList.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-remove-temp');
      if (btn) {
        removeTempSubtask(btn.parentElement);
      }
    });

    // Delegated clicks inside main Task List Feed
    elements.taskList.addEventListener('change', (e) => {
      // A. Checkbox click to toggle main task
      if (e.target.classList.contains('task-complete-checkbox')) {
        const taskId = e.target.closest('.task-card').dataset.id;
        toggleTaskCompletion(taskId, e.target.checked);
      }
      // B. Checkbox click to toggle subtasks
      if (e.target.classList.contains('subtask-toggle')) {
        const card = e.target.closest('.task-card');
        const taskId = card.dataset.id;
        const subId = e.target.closest('.card-subtask-item').dataset.subId;
        toggleSubtaskCompletion(taskId, subId, e.target.checked);
      }
    });

    elements.taskList.addEventListener('click', (e) => {
      const target = e.target;
      const card = target.closest('.task-card');
      if (!card) return;
      const taskId = card.dataset.id;

      // A. Edit button click
      const editBtn = target.closest('.btn-edit');
      if (editBtn) {
        openEditModal(taskId);
        return;
      }

      // B. Delete button click
      const deleteBtn = target.closest('.btn-delete');
      if (deleteBtn) {
        deleteTask(taskId);
        return;
      }

      // C. Expand/Collapse subtask accordion click
      const subHeader = target.closest('.subtasks-header');
      if (subHeader) {
        const isCollapsed = subHeader.classList.toggle('collapsed');
        subHeader.setAttribute('aria-expanded', !isCollapsed);
        return;
      }
    });

    // Filters Bar: Tabs clicks
    const tabsContainer = document.querySelector('.status-filters');
    tabsContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.filter-tab');
      if (!tab) return;

      elements.statusTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Update state filter, adjust header tab attributes, re-render feed
      state.filters.status = tab.dataset.filter;
      elements.taskList.setAttribute('aria-labelledby', tab.id);
      renderTasks();
    });

    // Filters Bar: Sort changes
    elements.sortSelect.addEventListener('change', (e) => {
      state.filters.sortBy = e.target.value;
      renderTasks();
    });

    // Filters Bar: Search text inputs (Live updates)
    elements.searchInput.addEventListener('input', (e) => {
      state.filters.searchQuery = e.target.value;
      
      // Toggle search text clear button layout representation
      if (state.filters.searchQuery) {
        elements.btnClearSearch.style.display = 'block';
      } else {
        elements.btnClearSearch.style.display = 'none';
      }
      renderTasks();
    });

    // Clear search query button click
    elements.btnClearSearch.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.filters.searchQuery = '';
      elements.btnClearSearch.style.display = 'none';
      renderTasks();
      elements.searchInput.focus();
    });

    // Filters Bar: Category pill clicks
    elements.categoryPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.category-pill');
      if (!pill) return;

      document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      state.filters.category = pill.dataset.category;
      renderTasks();
    });

    // Footer actions: Clear completed button
    elements.btnClearCompleted.addEventListener('click', clearCompletedTasks);

    // Edit modal form submit
    elements.editForm.addEventListener('submit', handleEditFormSubmit);

    // Cancel edit modal clicks
    elements.btnCancelEdit.addEventListener('click', () => {
      elements.editModal.close();
    });

    elements.btnCloseModal.addEventListener('click', () => {
      elements.editModal.close();
    });

    // Keyboard Dialog Accessibility: Close on clicking overlay backdrop
    elements.editModal.addEventListener('click', (e) => {
      const rect = elements.editModal.getBoundingClientRect();
      const clickInside = (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );
      if (!clickInside) {
        elements.editModal.close();
      }
    });

    // Theme toggle button click
    elements.themeToggle.addEventListener('click', () => {
      const isLight = document.documentElement.classList.toggle('light-mode');
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
      showToast(`Switched to ${isLight ? 'Light' : 'Dark'} Mode`);
    });
  }

  // --- 12. RUN INITIALIZATION ON BOOT ---
  init();
});
