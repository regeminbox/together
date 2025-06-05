// ===== 전역 변수 =====
let stockChart = null;

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', function() {
    // 현재 날짜 설정
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    
    document.getElementById('end-date').value = today.toISOString().split('T')[0];
    document.getElementById('start-date').value = threeDaysAgo.toISOString().split('T')[0];
    
    // Enter 키 이벤트 처리
    setupEventListeners();
    
    // 로딩 상태 초기화
    document.querySelectorAll('.loading').forEach(el => {
        el.classList.remove('active');
    });
});

// ===== 이벤트 리스너 설정 =====
function setupEventListeners() {
    document.getElementById('search-query').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });
    
    document.getElementById('stock-symbol').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            performStockAnalysis();
        }
    });
    

}

// ===== 탭 전환 =====
function switchTab(tabName) {
    // 모든 탭과 네비게이션 아이템 비활성화
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // 선택된 탭 활성화
    document.getElementById(tabName + '-tab').classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// ===== 빠른 검색 기능 =====
function quickSearch(query) {
    document.getElementById('search-query').value = query;
    performSearch();
}

// ===== 빠른 주식 선택 =====
function quickStock(symbol) {
    document.getElementById('stock-symbol').value = symbol;
}



// ===== 검색 기능 =====
async function performSearch() {
    const query = document.getElementById('search-query').value.trim();
    if (!query) {
        alert('검색어를 입력하세요.');
        return;
    }
    
    const resultContainer = document.getElementById('search-result-container');
    const resultDiv = document.getElementById('search-result');
    const loadingDiv = document.getElementById('search-loading');
    
    resultContainer.style.display = 'none';
    loadingDiv.classList.add('active');
    
    try {
        const response = await fetch('/tools/call', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'google_web_search',
                arguments: { query: query }
            })
        });
        
        if (!response.ok) {
            throw new Error(`API 오류: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.content && data.content.length > 0) {
            const summary = data.content[0].text;
            resultDiv.innerHTML = summary.replace(/\n/g, '<br>');
        } else {
            resultDiv.innerHTML = '검색 결과가 없습니다.';
        }
        
        resultContainer.style.display = 'block';
    } catch (error) {
        console.error('검색 오류:', error);
        resultDiv.innerHTML = `<div class="error">오류: ${error.message}</div>`;
        resultContainer.style.display = 'block';
    } finally {
        loadingDiv.classList.remove('active');
    }
}

// ===== 주식 분석 기능 =====
async function performStockAnalysis() {
    const symbol = document.getElementById('stock-symbol').value.trim();
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    if (!symbol || !startDate || !endDate) {
        alert('모든 필드를 입력하세요.');
        return;
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
        alert('시작일이 종료일보다 이전이어야 합니다.');
        return;
    }
    
    const resultContainer = document.getElementById('stock-result-container');
    const resultDiv = document.getElementById('stock-result');
    const loadingDiv = document.getElementById('stock-loading');
    
    // 기존 차트 정리
    if (stockChart) {
        stockChart.destroy();
        stockChart = null;
    }
    
    resultContainer.style.display = 'none';
    loadingDiv.classList.add('active');
    
    try {
        const response = await fetch('/tools/call', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'stock_analysis',
                arguments: {
                    symbol: symbol,
                    startDate: startDate,
                    endDate: endDate
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`API 오류: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.content && data.content.length > 0) {
            try {
                const analysisData = JSON.parse(data.content[0].text);
                displayStockAnalysis(analysisData);
            } catch (parseError) {
                console.error('JSON 파싱 오류:', parseError);
                resultDiv.innerHTML = `<div class="error">데이터 처리 중 오류가 발생했습니다.</div>`;
            }
        }
        
        resultContainer.style.display = 'block';
    } catch (error) {
        console.error('주식 분석 오류:', error);
        resultDiv.innerHTML = `<div class="error">주식 분석 중 오류가 발생했습니다: ${error.message}</div>`;
        resultContainer.style.display = 'block';
    } finally {
        loadingDiv.classList.remove('active');
    }
}



// ===== 주식 분석 결과 표시 =====
function displayStockAnalysis(data) {
    const resultDiv = document.getElementById('stock-result');
    
    // 오류 처리
    if (data.error) {
        resultDiv.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <h3>주식 데이터를 가져올 수 없습니다</h3>
                <p>${data.error}</p>
            </div>
        `;
        return;
    }
    
    const direction = data.priceChange.direction;
    const changeClass = direction === 'up' ? 'positive' : direction === 'down' ? 'negative' : '';
    const changeSymbol = data.priceChange.absolute >= 0 ? '+' : '';
    
    // 통화 기호 및 포맷팅
    const isKorean = data.market === 'KR';
    const currency = data.priceChange.currency || (isKorean ? '₩' : '$');
    
    let formattedPrice;
    if (isKorean) {
        formattedPrice = `${changeSymbol}${currency}${Math.abs(data.priceChange.absolute).toLocaleString('ko-KR')}`;
    } else {
        formattedPrice = `${changeSymbol}${currency}${Math.abs(data.priceChange.absolute).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    resultDiv.innerHTML = `
        <div class="stock-header">
            <h2>${data.symbol} (${data.market === 'KR' ? '한국' : '미국'} 시장)</h2>
            <div class="price-change ${changeClass}">
                ${formattedPrice}
                (${changeSymbol}${data.priceChange.percentage.toFixed(2)}%)
            </div>
            <p>${data.period}</p>
        </div>
        
        <div class="chart-container">
            <h3>주가 차트</h3>
            <canvas id="stockChart"></canvas>
        </div>
        
        <div class="analysis-section">
            <h3>AI 분석</h3>
            <div style="white-space: pre-wrap; line-height: 1.8;">${data.analysis}</div>
        </div>
        
        <div class="analysis-section">
            <h3>관련 뉴스 (최근 5개)</h3>
            <div>
                ${data.news && data.news.length > 0 ? 
                    data.news.map(news => `
                        <div class="news-item">
                            <h4>${news.title}</h4>
                            <p>${news.description}</p>
                            <a href="${news.url}" target="_blank">원문 보기 →</a>
                        </div>
                    `).join('') : 
                    '<p>관련 뉴스를 찾을 수 없습니다.</p>'
                }
            </div>
        </div>
    `;
    
    // 차트 그리기
    setTimeout(() => {
        drawStockChart(data.chartData, data.market);
    }, 200);
}

// ===== 주가 차트 그리기 =====
function drawStockChart(chartData, market) {
    const ctx = document.getElementById('stockChart').getContext('2d');
    
    if (stockChart) {
        stockChart.destroy();
    }
    
    const isKorean = market === 'KR';
    const currencySymbol = isKorean ? '₩' : '$';
    
    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: `종가 (${currencySymbol})`,
                data: chartData.prices,
                borderColor: '#0066ff',
                backgroundColor: 'rgba(0, 102, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#0066ff',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 0
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            if (isKorean) {
                                return currencySymbol + value.toLocaleString('ko-KR');
                            } else {
                                return currencySymbol + value.toLocaleString('en-US', { 
                                    minimumFractionDigits: 2, 
                                    maximumFractionDigits: 2 
                                });
                            }
                        }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                }
            }
        }
    });
}