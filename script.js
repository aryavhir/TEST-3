
(function() {
    const config = {
        callUrl: 'https://dev-ade-an.hydro.online',
        eventURl: 'https://dev-ad-events.hydro.online'
    };
    let adSessionData = {
        hostname: window.location.hostname,
        adSessionId: null,
        adClicked: false,
        clickTimestamp: null,
        timeDelay: 36000000 // 10 hours in milliseconds
    };
    let tag_Id = window.Hydro_tagId;
    let adsId = '';
    let adSessionId = generateAdSessionId();
    let adContainer = null;
    let imageUrl, redirectUrl;
    let isAdClosed = false;
    let lastSentStatus = null;
    let alreadyShownAds = [];
    let adVisible = true;
    let isWaitingForNewAd = false;
    let isFetchingAd = false;
    let adClicked = false;
    let campID = '';
    let totalImages = 6;
    let scrollInterval = null;
   // Add a flag to track if we're handling a page unload
   let isPageUnloading = false;
    function generateAdSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            let r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }
  // Modified initializeAdSession to handle page navigation within same domain
  function initializeAdSession() {
    const storedSession = sessionStorage.getItem('adSessionData');
    if (storedSession) {
        const parsedSession = JSON.parse(storedSession);
        // Check if we're on the same domain and session is still valid
        if (parsedSession.hostname === window.location.hostname) {
            const sessionAge = Date.now() - (parsedSession.lastAccessed || 0);
            // Keep session if we're within same domain and session isn't too old
            // (optional: add maximum session age check)
            adSessionData = parsedSession;
            adSessionData.lastAccessed = Date.now(); // Update last access time
            adSessionId = adSessionData.adSessionId;
            saveAdSession();
        } else {
            resetAdSession();
        }
    } else {
        resetAdSession();
    }
}
function resetAdSession() {
    adSessionData = {
        hostname: window.location.hostname,
        adSessionId: generateAdSessionId(),
        adClicked: false,
        clickTimestamp: null,
        timeDelay: 36000000,
        lastAccessed: Date.now() // Add timestamp for session tracking
    };
    adSessionId = adSessionData.adSessionId;
    saveAdSession();
}
    function saveAdSession() {
        sessionStorage.setItem('adSessionData', JSON.stringify(adSessionData));
    }
    function resetSessionId() {
        adSessionId = generateAdSessionId();
        adSessionData.adSessionId = adSessionId;
        saveAdSession();
    }

    function closeAdSession() {
        clearAd();
        alreadyShownAds = [];
        resetSessionId();
    }

     // Listen for beforeunload to detect page refresh/navigation
     window.addEventListener('beforeunload', () => {
        isPageUnloading = true;
        // This flag will be reset on the new page load
    });

    // Modified visibility change handler
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // Only close session if it's not a page refresh/navigation
            if (!isPageUnloading) {
                closeAdSession();
            }
        } else {
            if (isAdClosed && !isFetchingAd && !adClicked) {
                init();
            }
        }
    });
    
    // Modified focus/blur handlers
    window.addEventListener('focus', () => {
        if (!isPageUnloading && isAdClosed && !isFetchingAd && !adClicked) {
            init();
        }
    });

    window.addEventListener('blur', () => {
        if (!isPageUnloading && !isWaitingForNewAd) {
            if (!document.hidden && !adVisible && !adClicked) {
                closeAdSession();
            }
        }
    });
function sendErrorReport(errorCode, errorMessage) {
    fetch(config.eventURl + '/api/v1/ad-error',{
        method: 'POST',
        headers: {
            "Content-Type": 'application/json'
        },
        body: JSON.stringify({
            ad_session_id: adSessionId,
            pot_session_id:"pot67890",
            ad_request_id: generateAdSessionId(),
            ad_id: adsId,
            tag_id: tag_Id,
            campaign_id: campID,
            error_code: errorCode,
            error_message: errorMessage
        })
    }).then(response => response.json())
    .then(data => console.log('Error report sent:', data))
    .catch(error => console.error('Error sending error report:', error));
}
  // Modify getAdsId function to use the stored adSessionId
  async function getAdsId() {
    if (isFetchingAd) return;
    isFetchingAd = true;
    try {
        const response = await fetch(config.callUrl + '/api/v1/fetchbanner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ad_session_id: adSessionData.adSessionId,
                tag_id: tag_Id,
                ad_request_id: generateAdSessionId(),
                impression_count: 6,
                pot_session_id: 'potSessionId',
                already_shown_ad_ids: alreadyShownAds.join(",")
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(JSON.stringify(errorData));
        }
        
        const data = await response.json();
        
        // Check if reset_ad is true and reset the alreadyShownAds array
        if (data.reset_ad === true) {
            console.log('Resetting already shown ads array');
            alreadyShownAds = [];
        }

        adsId = data.AdInfo.ad_id;
        imageUrl = data.AdInfo.ad_creative_url;
        redirectUrl = data.AdInfo.redirect_url;
        campID = data.AdInfo.campaign_id;
        console.log('Fetched redirect URL:', redirectUrl);

        if (!imageUrl) throw new Error('Image URL not received');
        alreadyShownAds.push(adsId);
        return { adsId, imageUrl, redirectUrl };
    } catch (error) {
        console.error('Error getting ad data:', error);
        sendErrorReport('FETCH_AD_NEW_SESSION', error.message);
        throw error;
    } finally {
        isFetchingAd = false;
    }
}

    function createAdContainer() {
        adContainer = document.createElement('div');
        Object.assign(adContainer.style, {
            position: 'fixed', bottom: '2%', left: '0', width: '96%', height: '15%', zIndex: '1000',
            overflow: 'hidden', marginLeft: '2%'
        });
        document.body.appendChild(adContainer);
    }

    function displayBanner() {
        if (!imageUrl || !adContainer) return;
        adContainer.innerHTML = '';
        const scrollWrapper = document.createElement('div');
        scrollWrapper.style.whiteSpace = 'nowrap';
        scrollWrapper.style.position = 'absolute';
        scrollWrapper.style.height = '100%';
    
        const imageLoadPromises = [];
    
        for (let i = 0; i < totalImages; i++) {
            imageLoadPromises.push(addImage(scrollWrapper, i));
        }
    
        adContainer.appendChild(scrollWrapper);
        adContainer.style.display = 'block';
        isAdClosed = false;
    
        Promise.all(imageLoadPromises).then(() => {
            const singleImageWidth = scrollWrapper.firstChild.offsetWidth;
            startScrolling(scrollWrapper, singleImageWidth);
        }).catch((error) => {
            console.error("Error loading images:", error);
        });
    }

    function addImage(scrollWrapper, index) {
        return new Promise((resolve, reject) => {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.height = '100%';
            img.style.borderRadius = '14px';
            img.style.marginRight = '20px';
            img.style.cursor = 'pointer';
            const currentRedirectUrl = redirectUrl;
        
            img.onload = () => {
                img.endEventSent = false; // Add this flag
                const observer = new IntersectionObserver(entries => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            if (!img.startEventSent) {
                                img.startEventSent = true;
                                sendStatus('start');
                                
                                // Start checking right edge when image enters view
                                checkRightEdge = () => {
                                    const rect = img.getBoundingClientRect();
                                    const windowWidth = window.innerWidth;
                                    
                                    if (rect.right <= windowWidth && !img.midEventSent) {
                                        img.midEventSent = true;
                                        sendStatus('middle');
                                        cancelAnimationFrame(img.rafId);
                                    }
                                    
                                    if (!img.midEventSent) {
                                        img.rafId = requestAnimationFrame(checkRightEdge);
                                    }
                                };
                                checkRightEdge();
                            }
                        } else {
                            if (img.startEventSent && img.midEventSent && !img.endEventSent) {
                                img.endEventSent = true; // Mark end event as sent
                                sendStatus('end');
                                if (index === totalImages - 1) {
                                    // Don't call fetchNewAd here anymore
                                    // It will be handled by the animation end
                                }
                            }
                        }
                    });
                }, { threshold: [0] });
        
                observer.observe(img);
                resolve();
            };
    
            img.onerror = () => {
                console.error('Image failed to load:', imageUrl);
                reject('Image load error');
            };
    
            img.onclick = () => handleAdClick(img, currentRedirectUrl);
    
            scrollWrapper.appendChild(img);
        });
    }
    function handleAdClick(img, currentRedirectUrl) {
        adSessionData.adClicked = true;
        adSessionData.clickTimestamp = Date.now();
        saveAdSession();
        sendClickStatus();
        closeAd();
        window.open(currentRedirectUrl, '_blank');
    }
    
    function shouldShowAd() {
        if (!adSessionData.adClicked) return true;
        const elapsedTime = Date.now() - adSessionData.clickTimestamp;
        return elapsedTime >= adSessionData.timeDelay;
    }

    async function sendClickStatus() {
        try {
            const response = await fetch(config.eventURl + '/api/v1/ad-click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ad_session_id: adSessionId,
                    ad_id: adsId,
                    pot_session_id: "pot67890",
                    ad_request_id: generateAdSessionId(),
                    campaign_id: campID,
                    tag_id: tag_Id,
                    redirect_url: redirectUrl
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(JSON.stringify(errorData));
            }
            const data = await response.json();
            console.log('Click status sent:', data);
        } catch (error) {
            sendErrorReport('CLICK_TRACK_ERROR', error.message);
        }
    }

    function startScrolling(element, singleImageWidth) {
        if (scrollInterval) {
            clearInterval(scrollInterval);
        }
    
        const duration = 5000; // 5 seconds for each image
        const speed = singleImageWidth / duration; 
        let position = window.innerWidth;
        let lastTimestamp = 0;
        let animationComplete = false;
    
        function animate(timestamp) {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const elapsed = timestamp - lastTimestamp;
            position -= speed * elapsed;
    
            // Check if animation should complete
            if (position <= -singleImageWidth * totalImages) {
                if (!animationComplete) {
                    animationComplete = true;
                    // Ensure last image is fully out of view
                    element.style.transform = `translateX(${-(singleImageWidth * totalImages + window.innerWidth)}px)`;
                    
                    // Force the end event for the last image
                    const lastImage = element.children[totalImages - 1];
                    if (lastImage && lastImage.startEventSent && lastImage.midEventSent && !lastImage.endEventSent) {
                        lastImage.endEventSent = true;
                        sendStatus('end');
                    }
    
                    // Wait for status to be sent before fetching new ad
                    setTimeout(() => {
                        fetchNewAd();
                    }, 200);
                    return;
                }
            }
    
            element.style.transform = `translateX(${position}px)`;
            lastTimestamp = timestamp;
            if (!animationComplete) {
                scrollInterval = requestAnimationFrame(animate);
            }
        }
    
        scrollInterval = requestAnimationFrame(animate);
    }

    function clearAd() {
        if (adContainer) {
            adContainer.style.display = 'none';
            adContainer.innerHTML = '';
            isAdClosed = true;
            imageUrl = redirectUrl = adsId = '';
            currentImageIndex = 0;
        }
        if (scrollInterval) {
            cancelAnimationFrame(scrollInterval);
            scrollInterval = null;
        }
    }

    function closeAd() {
        clearAd();
    }
  
    async function sendStatus(event) {
        if (!adsId || (event === lastSentStatus && event !== 'start' && event !== 'middle' && event !== 'end')) return;
        lastSentStatus = event;
        try {
            const response = await fetch(config.eventURl + '/api/v1/ad-display', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ad_session_id: adSessionId,
                    ad_id: adsId,
                    pot_session_id: "pot67890",
                    ad_request_id: generateAdSessionId(),
                    ad_position: event,
                    campaign_id: campID,
                    tag_id: tag_Id,
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(JSON.stringify(errorData));
            }
            const data = await response.json();
            console.log('Status sent:', data);
        } catch (error) {
            console.error('Error sending status:', error);
            sendErrorReport('DISPLAY_TRACK_ERROR', error.message);
        }
    }

    async function fetchNewAd() {
        if (isFetchingAd) return;
        if (adClicked) {
            adClicked = false;
        }
        clearAd();
        try {
            await getAdsId();
            displayBanner();
            isWaitingForNewAd = false;
        } catch (error) {
            console.error('Error fetching new ad:', error);
            sendErrorReport('FETCH_AD_EXISTING_SESSION', error.message);
        }
    }
    async function init() {
        initializeAdSession();
        if (shouldShowAd()) {
            try {
                await getAdsId();
                createAdContainer();
                displayBanner();
            } catch (error) {
                console.error('Failed to initialize ad:', error);
            }
        }
    }
    init();
   // Add auto-refresh check interval at the end
   setInterval(() => {
    if (adSessionData.adClicked && isAdClosed && !isFetchingAd) {
        const elapsedTime = Date.now() - adSessionData.clickTimestamp;
        if (elapsedTime >= adSessionData.timeDelay) {
            console.log('Time delay completed, reinitializing ad');
            adSessionData.adClicked = false;
            saveAdSession();
            init();
        }
    }
}, 60000); // Check every 60 seconds
})();