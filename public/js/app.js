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
    // 모든 탭 비활성화
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 선택된 탭 활성화
    event.target.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
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
    loadingDiv.style.display = 'block';
    
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
        
        resultDiv.innerHTML = '';
        
        if (data.content && data.content.length > 0) {
            const summary = data.content[0].text;
            const details = data.content[1] ? data.content[1].text : '';
            
            resultDiv.innerHTML = `
                <h3>📊 AI 요약</h3>
                <p>${summary}</p>
                <h3>🔍 상세 결과</h3>
                <pre style="white-space: pre-wrap;">${details}</pre>
            `;
        } else {
            resultDiv.innerHTML = '<p>검색 결과가 없습니다.</p>';
        }
        
        resultContainer.style.display = 'block';
    } catch (error) {
        console.error('검색 오류:', error);
        resultDiv.innerHTML = `<div class="error">오류: ${error.message}</div>`;
        resultContainer.style.display = 'block';
    } finally {
        loadingDiv.style.display = 'none';
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
    
    // 기존 차트 정리 (메모리 누수 방지)
    if (stockChart && typeof stockChart.destroy === 'function') {
        stockChart.destroy();
        stockChart = null;
    }
    
    resultContainer.style.display = 'none';
    loadingDiv.style.display = 'block';
    
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
        console.log('주식 분석 응답:', data);
        
        if (data.content && data.content.length > 0) {
            // MCP 형식 응답 처리
            try {
                const analysisData = JSON.parse(data.content[0].text);
                displayStockAnalysis(analysisData);
            } catch (parseError) {
                console.error('JSON 파싱 오류:', parseError);
                resultDiv.innerHTML = `<div class="error">데이터 처리 중 오류가 발생했습니다: ${parseError.message}</div>`;
            }
        } else {
            // 직접 응답 처리
            displayStockAnalysis(data);
        }
        
        resultContainer.style.display = 'block';
    } catch (error) {
        console.error('주식 분석 오류:', error);
        
        // 에러 메시지를 사용자 친화적으로 표시
        const errorData = {
            error: `주식 분석 중 오류가 발생했습니다: ${error.message}`
        };
        displayStockAnalysis(errorData);
        resultContainer.style.display = 'block';
    } finally {
        loadingDiv.style.display = 'none';
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
                <div class="error-message">
                    ${data.error.replace(/\n/g, '<br>')}
                </div>
                <div class="error-suggestions">
                    <h4>💡 추천 사항:</h4>
                    <ul>
                        <li>주말/공휴일이 아닌 거래일로 설정해보세요</li>
                        <li>미국 주식을 사용해보세요 (예: AAPL, TSLA, MSFT)</li>
                        <li>지원하는 한국 주식 목록을 확인해보세요</li>
                    </ul>
                </div>
                <button class="btn" onclick="showSupportedStocks()">지원 종목 보기</button>
            </div>
        `;
        return;
    }
    
    const direction = data.priceChange.direction;
    const headerClass = direction === 'up' ? '' : direction === 'down' ? 'negative' : 'neutral';
    const changeSymbol = data.priceChange.absolute >= 0 ? '+' : '';
    
    // 통화 기호 및 포맷팅 처리
    const isKorean = data.market === 'KR';
    const currency = data.priceChange.currency || (isKorean ? '₩' : '$');
    
    let formattedPrice;
    if (isKorean) {
        formattedPrice = `${changeSymbol}${currency}${Math.abs(data.priceChange.absolute).toLocaleString('ko-KR')}`;
    } else {
        formattedPrice = `${changeSymbol}${currency}${Math.abs(data.priceChange.absolute).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    resultDiv.innerHTML = `
        <div class="stock-header ${headerClass}">
            <h2>${data.symbol} (${data.market === 'KR' ? '한국' : '미국'} 시장)</h2>
            <div class="price-change" style="color: white;">
                ${formattedPrice}
                (${changeSymbol}${data.priceChange.percentage.toFixed(2)}%)
            </div>
            <p>${data.period}</p>
        </div>
        
        <div class="chart-container">
            <h3>📈 주가 차트</h3>
            <div style="height: 300px; position: relative;">
                <canvas id="stockChart" style="max-width: 100%; max-height: 100%;"></canvas>
            </div>
        </div>
        
        <div class="analysis-section">
            <h3>🤖 AI 분석</h3>
            <div style="white-space: pre-wrap; line-height: 1.8;">${data.analysis}</div>
        </div>
        
        <div class="analysis-section">
            <h3>📰 관련 뉴스</h3>
            <div id="news-container">
                ${data.news && data.news.length > 0 ? 
                    data.news.map(news => `
                        <div class="news-item">
                            <h4>${news.title}</h4>
                            <p>${news.description}</p>
                            <a href="${news.url}" target="_blank">뉴스 원문 보기 →</a>
                        </div>
                    `).join('') : 
                    '<p>관련 뉴스를 찾을 수 없습니다.</p>'
                }
            </div>
        </div>
    `;
    
    // 차트 그리기
    setTimeout(() => {
        // 차트 컨테이너 크기 초기화
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.style.height = '400px';
        }
        drawStockChart(data.chartData, data.market);
    }, 100);
}

// ===== 주가 차트 그리기 =====
function drawStockChart(chartData, market) {
    const ctx = document.getElementById('stockChart').getContext('2d');
    
    // 기존 차트가 있으면 제거 (메모리 누수 방지)
    if (stockChart && typeof stockChart.destroy === 'function') {
        stockChart.destroy();
    }
    
    // 시장에 따른 통화 표시 결정
    const isKorean = market === 'KR';
    const currencySymbol = isKorean ? '₩' : '$';
    
    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: `종가 (${currencySymbol})`,
                data: chartData.prices,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 1,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 12
                        }
                    }
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
                        },
                        font: {
                            size: 11
                        },
                        maxTicksLimit: 6
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 11
                        },
                        maxTicksLimit: 5
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                }
            },
            elements: {
                point: {
                    hoverRadius: 6
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: {
                duration: 1000
            }
        }
    });
}

// ===== 지원 종목 보기 =====
function showSupportedStocks() {
    const resultDiv = document.getElementById('stock-result');
    resultDiv.innerHTML = `
        <div class="supported-stocks">
            <h3>📋 지원하는 주식 종목</h3>
            
            <div class="stock-category">
                <h4>🇰🇷 한국 주식</h4>
                <div class="stock-list">
                    <span class="stock-tag" onclick="useStock('삼성전자')">삼성전자 (005930)</span>
                    <span class="stock-tag" onclick="useStock('SK하이닉스')">SK하이닉스 (000660)</span>
                    <span class="stock-tag" onclick="useStock('네이버')">네이버 (035420)</span>
                    <span class="stock-tag" onclick="useStock('현대차')">현대차 (005380)</span>
                    <span class="stock-tag" onclick="useStock('기아')">기아 (000270)</span>
                    <span class="stock-tag" onclick="useStock('LG에너지솔루션')">LG에너지솔루션 (373220)</span>
                    <span class="stock-tag" onclick="useStock('POSCO')">POSCO (005490)</span>
                    <span class="stock-tag" onclick="useStock('LG화학')">LG화학 (051910)</span>
                    <span class="stock-tag" onclick="useStock('카카오')">카카오 (035720)</span>
                    <span class="stock-tag" onclick="useStock('셀트리온')">셀트리온 (068270)</span>
                </div>
            </div>
            
            <div class="stock-category">
                <h4>🇺🇸 미국 주식</h4>
                <div class="stock-list">
                    <span class="stock-tag" onclick="useStock('AAPL')">Apple (AAPL)</span>
                    <span class="stock-tag" onclick="useStock('MSFT')">Microsoft (MSFT)</span>
                    <span class="stock-tag" onclick="useStock('GOOGL')">Google (GOOGL)</span>
                    <span class="stock-tag" onclick="useStock('AMZN')">Amazon (AMZN)</span>
                    <span class="stock-tag" onclick="useStock('TSLA')">Tesla (TSLA)</span>
                    <span class="stock-tag" onclick="useStock('META')">Meta (META)</span>
                    <span class="stock-tag" onclick="useStock('NVDA')">NVIDIA (NVDA)</span>
                    <span class="stock-tag" onclick="useStock('NFLX')">Netflix (NFLX)</span>
                </div>
            </div>
            
            <div class="help-section">
                <h4>📝 사용 방법</h4>
                <ul>
                    <li>위 종목들을 클릭하면 자동으로 입력됩니다</li>
                    <li>한국 주식은 한글명 또는 6자리 종목코드로 검색 가능</li>
                    <li>미국 주식은 영문 심볼로 검색 가능</li>
                </ul>
            </div>
            
            <button class="btn" onclick="goBackToInput()">다시 검색하기</button>
        </div>
    `;
}

// ===== 종목 선택 및 입력 =====
function useStock(stockSymbol) {
    document.getElementById('stock-symbol').value = stockSymbol;
    goBackToInput();
}

function goBackToInput() {
    const resultContainer = document.getElementById('stock-result-container');
    resultContainer.style.display = 'none';
    document.getElementById('stock-symbol').focus();
}