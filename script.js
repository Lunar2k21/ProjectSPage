// Translations
const translations = {
    pl: {
        title: "Project Simracing - Polska Liga Rajdów Samochodowych",
        community: "Społeczność",
        discord: "Discord",
        facebookProfile: "Profil Facebook",
        youtubeChannel: "Kanał Youtube",
        leagueEA: "Liga EA Sports WRC",
        clubEA: "Klub EA Racenet",
        resultsSheet: "Arkusz Wyników",
        registrationForm: "Formularz zgłoszeniowy",
        assetto: "Assetto Corsa Rally",
        facebookGroup: "Grupa Facebook",
        assettoLeague: "Liga Assetto Corsa Rally (wkrótce)",
        supportPatronite: "Wspieraj na Patronite.pl",
        scrollDown: "↓ Wyniki/Media ↓",
        latestContent: "Najnowsze treści",
        videoBtn: "Video",
        galleryBtn: "Galeria",
        resultsTable: "Tabela Wyników",
        season13: "Sezon 13.",
        pateraCup: "PaTera Cup",
        loadingResults: "Ładowanie wyników...",
        noFile: "Nie znaleziono pliku z wynikami.",
        placeFile: "Umieść plik Excel w folderze 'data/'",
        localServerNote: "<strong>UWAGA:</strong> Do testowania lokalnego musisz uruchomić stronę przez lokalny serwer (np. Live Server w VS Code lub Python HTTP Server).",
        noSheets: "Plik Excel nie zawiera arkuszy",
        noVisibleSheets: "Brak widocznych arkuszy do wyświetlenia",
        cannotRead: "Nie można odczytać arkusza",
        noData: "Brak danych w pliku"
    },
    en: {
        title: "Project Simracing - Polish Rally League",
        community: "Community",
        discord: "Discord",
        facebookProfile: "Facebook Profile",
        youtubeChannel: "Youtube Channel",
        leagueEA: "EA Sports WRC League",
        clubEA: "EA Racenet Club",
        resultsSheet: "Results Sheet",
        registrationForm: "Registration Form",
        assetto: "Assetto Corsa Rally",
        facebookGroup: "Facebook Group",
        assettoLeague: "Assetto Corsa Rally League (coming soon)",
        supportPatronite: "Support on Patronite.pl",
        scrollDown: "↓ Results/Media ↓",
        latestContent: "Latest Content",
        videoBtn: "Video",
        galleryBtn: "Gallery",
        resultsTable: "Results Table",
        season13: "Season 13",
        pateraCup: "PaTera Cup",
        loadingResults: "Loading results...",
        noFile: "Results file not found.",
        placeFile: "Place Excel file in 'data/' folder",
        localServerNote: "<strong>NOTE:</strong> For local testing you must run the page through a local server (e.g. Live Server in VS Code or Python HTTP Server).",
        noSheets: "Excel file contains no sheets",
        noVisibleSheets: "No visible sheets to display",
        cannotRead: "Cannot read sheet",
        noData: "No data in file"
    }
};

let currentLang = 'pl';

// Function to update page text
function updateLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];
    
    // Update document title
    document.title = t.title;
    
    // Update column titles
    const columnTitles = document.querySelectorAll('.column-title');
    if (columnTitles[0]) columnTitles[0].textContent = t.community;
    if (columnTitles[1]) columnTitles[1].textContent = t.leagueEA;
    if (columnTitles[2]) columnTitles[2].textContent = t.assetto;
    
    // Update link boxes
    const linkBoxes = document.querySelectorAll('.link-box');
    if (linkBoxes[0]) linkBoxes[0].textContent = t.discord;
    if (linkBoxes[1]) linkBoxes[1].textContent = t.facebookProfile;
    if (linkBoxes[2]) linkBoxes[2].textContent = t.youtubeChannel;
    if (linkBoxes[3]) linkBoxes[3].textContent = t.clubEA;
    if (linkBoxes[4]) linkBoxes[4].textContent = t.resultsSheet;
    if (linkBoxes[5]) linkBoxes[5].textContent = t.registrationForm;
    if (linkBoxes[6]) linkBoxes[6].textContent = t.facebookGroup;
    if (linkBoxes[7]) linkBoxes[7].textContent = t.assettoLeague;
    
    // Update patronite link
    const patroniteLink = document.querySelector('.patronite-link');
    if (patroniteLink) {
        patroniteLink.innerHTML = `
            <svg viewBox="0 0 24 24" class="flame-icon">
                <path d="M12 2C12 2 7 6 7 12C7 15.31 9.69 18 13 18C16.31 18 19 15.31 19 12C19 9 17 7 17 7C17 7 17.5 9 16 10.5C16 10.5 15 8 13 8C13 8 14 10 14 12C14 13.1 13.1 14 12 14C10.9 14 10 13.1 10 12C10 10 12 8 12 8C12 8 9 9 9 12C9 14.21 10.79 16 13 16C15.21 16 17 14.21 17 12C17 8 12 2 12 2Z"/>
            </svg>
            ${t.supportPatronite}
        `;
    }
    
    // Update scroll down link
    const scrollDownLink = document.querySelector('.scroll-down-link');
    if (scrollDownLink) {
        scrollDownLink.textContent = t.scrollDown;
    }
    
    // Update second section
    const h2 = document.querySelector('.second-content h2');
    if (h2) h2.textContent = t.latestContent;
    
    const switchBtns = document.querySelectorAll('.switch-btn');
    if (switchBtns[0]) switchBtns[0].textContent = t.videoBtn;
    if (switchBtns[1]) switchBtns[1].textContent = t.galleryBtn;
    
    const resultsH3 = document.querySelector('.results-section h3');
    if (resultsH3) resultsH3.textContent = t.resultsTable;
    
    const contestBtns = document.querySelectorAll('.contest-btn');
    if (contestBtns[0]) contestBtns[0].textContent = t.season13;
    if (contestBtns[1]) contestBtns[1].textContent = t.pateraCup;
    
    // Save language preference
    localStorage.setItem('language', lang);
}

// Auto-load images from folder
async function loadImagesFromFolder(folderPath, prefix, maxAttempts = 20) {
    const images = [];
    const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    for (let i = 1; i <= maxAttempts; i++) {
        let found = false;
        
        for (const ext of extensions) {
            const imagePath = `${folderPath}/${prefix}${i}.${ext}`;
            
            try {
                const response = await fetch(imagePath, { method: 'HEAD' });
                if (response.ok) {
                    images.push(imagePath);
                    found = true;
                    break;
                }
            } catch (error) {
                // Image doesn't exist, continue
            }
        }
        
        // If we didn't find an image with this number, stop searching
        if (!found && i > 3) {
            break;
        }
    }
    
    return images;
}

// Image Slider Functionality
document.addEventListener('DOMContentLoaded', async function() {
    // Theme Switcher
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    body.setAttribute('data-theme', savedTheme);
    
    themeToggle.addEventListener('click', function() {
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Load saved language or default to Polish
    const savedLang = localStorage.getItem('language') || 'pl';
    updateLanguage(savedLang);
    
    // Update active flag
    document.querySelectorAll('.lang-flag').forEach(flag => {
        flag.classList.toggle('active', flag.getAttribute('data-lang') === savedLang);
    });

    // Load slider images
    const sliderContainer = document.querySelector('.slider');
    const blurBg = document.querySelector('.image-blur-bg');
    const slideImages = await loadImagesFromFolder('images', 'slide');
    
    if (slideImages.length > 0) {
        // Clear existing slides
        sliderContainer.innerHTML = '';
        
        // Add new slides
        slideImages.forEach((imagePath, index) => {
            const img = document.createElement('img');
            img.src = imagePath;
            img.alt = `Rally Car ${index + 1}`;
            img.className = index === 0 ? 'slide active' : 'slide';
            sliderContainer.appendChild(img);
        });
        
        // Set initial blur background
        if (blurBg) {
            blurBg.style.backgroundImage = `url(${slideImages[0]})`;
        }
    }

    const slides = document.querySelectorAll('.slide');
    let currentSlide = 0;
    const slideInterval = 10000; // 10 seconds

    function nextSlide() {
        if (slides.length === 0) return;
        
        // Remove active class from current slide and add prev class
        slides[currentSlide].classList.remove('active');
        slides[currentSlide].classList.add('prev');

        // Move to next slide
        currentSlide = (currentSlide + 1) % slides.length;

        // Update blur background
        if (blurBg) {
            blurBg.style.backgroundImage = `url(${slides[currentSlide].src})`;
        }

        // Add active class to new slide
        slides[currentSlide].classList.add('active');
        slides[currentSlide].classList.remove('prev');

        // Clean up prev class from other slides after animation
        setTimeout(() => {
            slides.forEach((slide, index) => {
                if (index !== currentSlide) {
                    slide.classList.remove('prev');
                }
            });
        }, 1000);
    }

    // Start automatic sliding
    if (slides.length > 1) {
        setInterval(nextSlide, slideInterval);
    }

    // Load gallery images
    const galleryGrid = document.querySelector('.gallery-grid');
    const galleryImages = await loadImagesFromFolder('images', 'gallery');
    
    if (galleryImages.length > 0) {
        // Clear existing gallery items
        galleryGrid.innerHTML = '';
        
        // Add new gallery items
        galleryImages.forEach((imagePath, index) => {
            const img = document.createElement('img');
            img.src = imagePath;
            img.alt = `Rally ${index + 1}`;
            img.className = 'gallery-item';
            img.onclick = function() { openImageModal(this); };
            galleryGrid.appendChild(img);
        });
    }

    // Media Switcher Functionality
    const switchButtons = document.querySelectorAll('.switch-btn');
    const mediaContents = document.querySelectorAll('.media-content');

    switchButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');

            // Remove active class from all buttons and contents
            switchButtons.forEach(btn => btn.classList.remove('active'));
            mediaContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and target content
            this.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Image Modal Functions
    window.openImageModal = function(imgElement) {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        modal.classList.add('active');
        modalImg.src = imgElement.src;
        document.body.style.overflow = 'hidden';
    };

    window.closeImageModal = function() {
        const modal = document.getElementById('imageModal');
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    // Close modal on background click
    document.getElementById('imageModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeImageModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeImageModal();
        }
    });

    // Excel File Loading from Folder
    let currentWorkbook = null;
    
    // Load main file on page load
    loadExcelFile('data/results.xlsx');

    // Contest Selector
    const contestButtons = document.querySelectorAll('.contest-btn');
    contestButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const filePath = this.getAttribute('data-file');
            
            // Remove active from all contest buttons
            contestButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Load selected file
            loadExcelFile(filePath);
        });
    });

    function loadExcelFile(primaryPath) {
        const t = translations[currentLang];
        const basePath = primaryPath.replace(/\.(xlsx|xls)$/, '');
        const possibleFiles = [
            primaryPath,
            `${basePath}.xlsx`,
            `${basePath}.xls`
        ];
        
        const uniqueFiles = [...new Set(possibleFiles)];
        tryLoadFiles(uniqueFiles, 0, t);
    }

    function tryLoadFiles(fileList, index, t) {
        if (index >= fileList.length) {
            document.getElementById('sheetSelector').innerHTML = '';
            document.getElementById('resultsTable').innerHTML = 
                `<p class="loading-text">${t.noFile}<br><br>
                ${t.placeFile}<br><br>
                ${t.localServerNote}</p>`;
            return;
        }

        const filePath = fileList[index];
        
        fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error('File not found');
                }
                return response.arrayBuffer();
            })
            .then(data => {
                const workbook = XLSX.read(data, { type: 'array' });
                currentWorkbook = workbook;
                displayExcelData(workbook);
            })
            .catch(error => {
                console.log(`Trying next file after error with ${filePath}:`, error.message);
                tryLoadFiles(fileList, index + 1, t);
            });
    }

    function displayExcelData(workbook) {
        const t = translations[currentLang];
        const sheetSelector = document.getElementById('sheetSelector');
        const resultsTable = document.getElementById('resultsTable');
        
        sheetSelector.innerHTML = '';
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            resultsTable.innerHTML = `<p class="loading-text">${t.noSheets}</p>`;
            return;
        }
        
        const visibleSheets = workbook.SheetNames.filter((sheetName, index) => {
            const sheet = workbook.Sheets[sheetName];
            const workbookSheet = workbook.Workbook?.Sheets?.[index];
            
            if (workbookSheet && workbookSheet.Hidden === 1) {
                return false;
            }
            
            if (sheetName.startsWith('_') || sheetName.toLowerCase().includes('hidden')) {
                return false;
            }
            
            return true;
        });
        
        if (visibleSheets.length === 0) {
            resultsTable.innerHTML = `<p class="loading-text">${t.noVisibleSheets}</p>`;
            return;
        }
        
        visibleSheets.forEach((sheetName, index) => {
            const btn = document.createElement('button');
            btn.className = 'sheet-btn' + (index === 0 ? ' active' : '');
            btn.textContent = sheetName;
            btn.addEventListener('click', function() {
                document.querySelectorAll('.sheet-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                displaySheet(workbook, sheetName);
            });
            sheetSelector.appendChild(btn);
        });
        
        if (visibleSheets.length > 0) {
            displaySheet(workbook, visibleSheets[0]);
        }
    }

    function displaySheet(workbook, sheetName) {
        const t = translations[currentLang];
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) {
            document.getElementById('resultsTable').innerHTML = 
                `<p class="loading-text">${t.cannotRead}</p>`;
            return;
        }
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        displayResultsTable(jsonData);
    }

    function displayResultsTable(data) {
        const t = translations[currentLang];
        const resultsTable = document.getElementById('resultsTable');
        
        if (data.length === 0) {
            resultsTable.innerHTML = `<p class="loading-text">${t.noData}</p>`;
            return;
        }

        let tableHTML = '<table><thead><tr>';

        const headers = data[0];
        headers.forEach(header => {
            tableHTML += `<th>${header || ''}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            
            if (!row || row.every(cell => !cell)) continue;

            tableHTML += '<tr>';
            headers.forEach((header, index) => {
                const cellValue = row[index] || '';
                tableHTML += `<td>${cellValue}</td>`;
            });
            tableHTML += '</tr>';
        }

        tableHTML += '</tbody></table>';
        resultsTable.innerHTML = tableHTML;
    }

    // Language Selector
    const langFlags = document.querySelectorAll('.lang-flag');
    
    langFlags.forEach(flag => {
        flag.addEventListener('click', function(e) {
            e.preventDefault();
            
            langFlags.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            
            const lang = this.getAttribute('data-lang');
            updateLanguage(lang);
        });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== '#pl' && href !== '#en') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // Add intersection observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    const animateElements = document.querySelectorAll('.second-content > *');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        observer.observe(el);
    });
});