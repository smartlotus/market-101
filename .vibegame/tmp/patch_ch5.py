import io, json
P = 'config/chapters.json'
d = json.load(io.open(P, encoding='utf-8'))
c5 = [c for c in d['chapters'] if c['id'] == 5][0]

# M03 不再走章级定向队列（否则会被更早的开市日先消耗掉），改为逐拍 forceEvent 钉住
c5['directedQueue'] = []
c5['pinnedEvents'] = []
c5['directedEvents'] = ['M03']

b4 = [b for b in c5['beats'] if b['id'] == '5.4'][0]
b4['forceEvent'] = 'M01'          # 无涨跌停的那一天：0.5 BAD 宏观，港股大幅下跌
b4['mentor'] = [
    {'timing': 'firstConcept', 'speaker': 'face', 'conceptKey': '无涨跌停',
     'line': '今天没有墙。而且这次——买一只留着，别卖。我们看看会发生什么。'},
]
b4['require'] = [
    {'kind': 'submit', 'id': '5.4.hold', 'expect': {'accepted': True, 'side': 'buy'},
     'label': '买入一只港股并留着（这次不卖）'},
    {'kind': 'advanceDay', 'id': '5.4.advance', 'label': '进入下一交易日，看看会发生什么',
     'simAction': ['advanceDay']},
    {'kind': 'read', 'id': '5.4.read', 'panelId': 'panel.noLimit', 'count': 4,
     'mustClose': True, 'label': '看清「没有墙」意味着什么'},
]

b5 = [b for b in c5['beats'] if b['id'] == '5.5'][0]
b5['forceEvent'] = 'M03'          # 唯一带 fxTarget 的事件：钉在「汇率咬了你一口」
b5['mentor'] = [
    {'timing': 'firstConcept', 'speaker': 'face', 'conceptKey': '汇率风险',
     'line': '美联储放了鹰派信号。你的港股未必跌了，但你的账户变少了。为什么？'},
]

io.open(P, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('5.4 forceEvent=M01 + 建仓持有要求；5.5 forceEvent=M03；章级定向队列清空')
