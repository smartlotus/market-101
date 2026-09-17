# -*- coding: utf-8 -*-
"""把第四章（隔壁的三栋楼）数据追加进 config/chapters.json。

只做**文本手术**：第一至三章的字节一字不动（JSON 往返会整体重排版，故不做）。
"""
import io
import json

PATH = 'config/chapters.json'
TAIL = '    }\n  ]\n}\n'  # 第三章对象收尾 + chapters 数组收尾 + 文件收尾

CH4 = {
    "id": 4,
    "name": "隔壁的三栋楼",
    "implemented": True,
    "situation": "你换了工作，新公司在金融街旁边。午休出门，你抬头发现三栋楼：一栋写着「证券」，一栋写着「基金」，一栋写着「交易所」。你在第一章开过户、在第三章买过基金，但你突然发现——你根本不知道这三栋楼里的人在做什么，也不知道你的钱经过了几双手。晚上老周约你吃了顿饭。",
    "preview": "隔壁的三栋楼：看清你的钱经过的每一双手。",
    "rated": False,
    "noScoreLabel": "本章不打分",
    "noRemedial": True,
    "clearResidualsOnEnter": True,
    "unlocks": {"instruments": []},
    "goalCard": {
        "title": "本章要什么：看清你的钱经过的每一双手",
        "teach": [
            "交易所",
            "券商",
            "基金管理人",
            "撮合",
            "买卖价差",
            "流动性",
            "银行",
            "清算交收",
            "监管机构",
            "存管",
            "停牌",
            "退市",
            "黑天鹅"
        ],
        "graded": False
    },
    "savePoints": ["4.2", "4.4"],
    "directedEvents": ["P02"],
    "pinnedEvents": [
        {
            "eventId": "P02",
            "beatId": "4.2",
            "marketDay": None,
            "note": "节拍 4.2 消耗一个开市日，定向事件在开市日抽签时被消费（PRD §7 定向事件）"
        }
    ],
    "directedQueue": [],
    "choices": {
        "4.2.match": {
            "id": "4.2.match",
            "question": "这一笔是谁和谁成交的？",
            "conceptKey": "撮合",
            "correctKey": "match",
            "options": [
                {
                    "key": "match",
                    "text": "有人愿意按 ¥10.43 买，正好有人按 ¥10.43 卖 —— 两边的价对上了，就成了这一笔。",
                    "feedback": "对。成交价不是谁写上去的，是两边的价第一次对上。两列挂单最下面的那两个价，就是下一次最可能成交的地方。"
                },
                {
                    "key": "exchange",
                    "text": "交易所定了一个 ¥10.43，大家照这个价成交。",
                    "feedback": "我们再摆一次：交易所只提供场地和规则，它自己既不买、也不卖、更不报价。你把两列挂单最下面的两个价摆一起看 —— 成交价是从它们中间出来的。"
                }
            ]
        },
        "4.5.ifNoRule": {
            "id": "4.5.ifNoRule",
            "question": "如果没有那道规定，会怎样？",
            "conceptKey": "存管",
            "correctKey": None,
            "options": [
                {
                    "key": "used",
                    "text": "那我的钱就可能被券商拿去用 —— 账面上还是那些数，但我真要取的时候，它未必拿得出来。",
                    "feedback": "你想到的这一层，就是那道规定要挡住的事。钱在你名下、和钱在它手里，太平的时候看着一样，不平的那天不一样。"
                },
                {
                    "key": "same",
                    "text": "短时间里大概看不出区别：我照常买卖，对账单上还是那些数。",
                    "feedback": "这话也成立 —— 太平的时候，有没有那道规定，体感是一样的。规定本来就不是为太平的那天写的。"
                }
            ]
        }
    },
    "panels": {
        "panel.tower.exchange": {
            "id": "panel.tower.exchange",
            "kind": "tower",
            "title": "第一栋：交易所",
            "blocks": [
                {
                    "type": "tower",
                    "id": "4.1.tower.exchange",
                    "name": "交易所",
                    "tagline": "开市的地方",
                    "lines": [
                        "全国想买、想卖的人，报的价都摆在这里的同一本簿子上。",
                        "它自己不做买卖，也不替你挑股票 —— 它只保证一件事：谁来都按同一条规则，谁先对上谁先成交。",
                        "你在第一章看到的那个「最新价」，就是从这里最后一笔成交里出来的。"
                    ],
                    "mentorLine": "这一栋的门谁都进得去，但进去只能报自己的价，改不了别人的价。"
                }
            ],
            "actions": [
                {"id": "4.1.closeExchange", "label": "收起来"}
            ]
        },
        "panel.tower.broker": {
            "id": "panel.tower.broker",
            "kind": "tower",
            "title": "第二栋：券商",
            "blocks": [
                {
                    "type": "tower",
                    "id": "4.1.tower.broker",
                    "name": "券商",
                    "tagline": "你开户的那一家",
                    "lines": [
                        "你在第一章开户的那家就是券商。它替你把委托送进交易所，也替你记账。",
                        "它经你的手、也过你的账，但有一条规定让它不能把客户的钱当成自己的钱用。",
                        "它的收入来自手续费 —— 你买卖一次，它收一次。"
                    ],
                    "mentorLine": "券商是你和交易所之间那扇门。它只负责转达，价还是你自己报。"
                }
            ],
            "actions": [
                {"id": "4.1.closeBroker", "label": "收起来"}
            ]
        },
        "panel.tower.fund": {
            "id": "panel.tower.fund",
            "kind": "tower",
            "title": "第三栋：基金公司",
            "blocks": [
                {
                    "type": "tower",
                    "id": "4.1.tower.fund",
                    "name": "基金管理人",
                    "tagline": "管那篮子的那家公司",
                    "lines": [
                        "你在第三章买的那只基金，钱交给的就是这一栋。",
                        "它把很多人的钱凑在一起，按事先说好的方法去买一篮子东西。",
                        "它不发股票，也不替你下单；它只做一件事 —— 按说好的方法管那笔钱。"
                    ],
                    "mentorLine": "它每做一笔都要留下记录给监管看。你交给它的钱不在它自己账上，是单独存着的。"
                }
            ],
            "actions": [
                {"id": "4.1.closeFund", "label": "收起来"}
            ]
        },
        "panel.orderBook": {
            "id": "panel.orderBook",
            "kind": "orderBook",
            "title": "今天的挂单簿",
            "blocks": [
                {
                    "type": "orderBook",
                    "id": "4.2.book",
                    "label": "挂单簿：卖出挂单 / 买入挂单",
                    "bids": [
                        {"price": 10.42, "qty": 2200},
                        {"price": 10.41, "qty": 900},
                        {"price": 10.40, "qty": 1500}
                    ],
                    "asks": [
                        {"price": 10.43, "qty": 500},
                        {"price": 10.44, "qty": 1200},
                        {"price": 10.45, "qty": 3000}
                    ],
                    "last": {"price": 10.43, "qty": 500},
                    "spread": 0.01,
                    "notes": [
                        "上面那一列是想卖的人在报价，下面那一列是想买的人在报价。",
                        "两列最下面那一行，是离成交最近的两个价 —— 它们只差 ¥0.01，这个差就是买卖价差。",
                        "差越小，想买想卖的人越容易立刻找到对手，我们就说它流动性好。"
                    ]
                },
                {"type": "choiceGroup", "id": "4.2.choice", "choiceId": "4.2.match"}
            ],
            "actions": [
                {"id": "4.2.closePanel", "label": "合上挂单簿"}
            ]
        },
        "panel.matchGame": {
            "id": "panel.matchGame",
            "kind": "matchGame",
            "title": "机构职责板",
            "blocks": [
                {"type": "matchGame", "id": "4.3.game", "gameId": "institutions"}
            ],
            "actions": [
                {"id": "4.3.closePanel", "label": "都配好了"}
            ]
        },
        "panel.flowWalk": {
            "id": "panel.flowWalk",
            "kind": "flowWalk",
            "title": "这笔钱走过的路",
            "blocks": [
                {"type": "flowWalk", "id": "4.4.walk", "walkId": "orderFlow"}
            ],
            "actions": [
                {"id": "4.4.closePanel", "label": "走完了"}
            ]
        },
        "panel.ifNoRule": {
            "id": "panel.ifNoRule",
            "kind": "reflection",
            "title": "如果没有那道规定",
            "blocks": [
                {
                    "type": "text",
                    "id": "4.5.prompt",
                    "label": "老周的提问",
                    "text": "你的钱进了券商，但券商不能拿它去做自己的事 —— 这条规定是谁在盯着？如果没有它，会怎样？"
                },
                {"type": "choiceGroup", "id": "4.5.choice", "choiceId": "4.5.ifNoRule"}
            ],
            "actions": [
                {"id": "4.5.closePanel", "label": "我想完了"}
            ]
        },
        "panel.badNews": {
            "id": "panel.badNews",
            "kind": "conceptCards",
            "title": "坏消息词条",
            "blocks": [
                {"type": "conceptCard", "id": "4.6.停牌", "conceptKey": "停牌"},
                {"type": "conceptCard", "id": "4.6.退市", "conceptKey": "退市"},
                {"type": "conceptCard", "id": "4.6.黑天鹅", "conceptKey": "黑天鹅"}
            ],
            "actions": [
                {"id": "4.6.closePanel", "label": "看过了"}
            ]
        },
        "panel.confirm": {
            "id": "panel.confirm",
            "kind": "understandingCheck",
            "title": "章末",
            "blocks": [
                {
                    "type": "text",
                    "id": "4.end.recap",
                    "label": "这一章我们看过的",
                    "text": "三栋楼你都进去了。这一章没让你花一分钱，但你现在知道了：你点一下「买入」，钱和股票要走过好几只手，每一只手都有它的道理。"
                },
                {
                    "type": "list",
                    "id": "4.end.hands",
                    "label": "你的钱经过的手",
                    "items": [
                        "交易所：搭台子、给规则",
                        "券商：替你转达、替你记账",
                        "银行：替你存着买卖用的钱",
                        "清算机构：算清谁欠谁多少",
                        "监管机构：定规则、看账",
                        "基金管理人：按说好的方法替你管那篮子"
                    ]
                }
            ],
            "actions": [
                {"id": "4.end.finish", "label": "继续"}
            ]
        }
    },
    "matchGames": {
        "institutions": {
            "id": "institutions",
            "prompt": "把这六张机构卡，配到它们各自做的那件事上。配不上就换一张再试 —— 这里不记次数。",
            "cards": [
                {"id": "exchange", "name": "交易所", "sub": "全国报价摆在同一本簿子的地方"},
                {"id": "broker", "name": "券商", "sub": "你开户的那一家"},
                {"id": "bank", "name": "银行", "sub": "替你保管钱的那家"},
                {"id": "clearing", "name": "清算机构", "sub": "成交之后算账的那家"},
                {"id": "regulator", "name": "监管机构", "sub": "不参与买卖、只看账的那家"},
                {"id": "fundManager", "name": "基金管理人", "sub": "管你那只基金的那家公司"}
            ],
            "targets": [
                {"key": "t.exchange", "label": "交易所", "text": "搭一个公开的场子，让买卖两边报的价摆在同一本簿子上，谁先对上谁先成交"},
                {"key": "t.broker", "label": "券商", "text": "替你把委托送进场、把持仓记在你账上，但不能自己动你的钱"},
                {"key": "t.bank", "label": "银行", "text": "替你存着买卖用的钱，按算好的结果划出划进"},
                {"key": "t.clearing", "label": "清算机构", "text": "成交之后算清谁该给谁多少钱、多少股"},
                {"key": "t.regulator", "label": "监管机构", "text": "不参与买卖，但规则由它定、每一层的账它都看得到"},
                {"key": "t.fundManager", "label": "基金管理人", "text": "把很多人的钱凑成一篮子，按事先说好的方法去管"}
            ],
            "pairs": [
                {"cardId": "exchange", "targetKey": "t.exchange", "requireId": "4.3.match.exchange"},
                {"cardId": "broker", "targetKey": "t.broker", "requireId": "4.3.match.broker"},
                {"cardId": "bank", "targetKey": "t.bank", "requireId": "4.3.match.bank"},
                {"cardId": "clearing", "targetKey": "t.clearing", "requireId": "4.3.match.clearing"},
                {"cardId": "regulator", "targetKey": "t.regulator", "requireId": "4.3.match.regulator"},
                {"cardId": "fundManager", "targetKey": "t.fundManager", "requireId": "4.3.match.fundManager"}
            ]
        }
    },
    "flowWalks": {
        "orderFlow": {
            "id": "orderFlow",
            "prompt": "你买入的那只 ETF，从你点下按钮到份额真正归你，经过了哪几个环节？按顺序点出来。",
            "cards": [
                {"id": "register", "label": "T+2 交收：股票登记到你名下"},
                {"id": "broker", "label": "券商把委托送到交易所"},
                {"id": "regulate", "label": "监管机构看这一路的账"},
                {"id": "buy", "label": "你点下「买入」"},
                {"id": "custody", "label": "存管账户把钱划给对手方"},
                {"id": "match", "label": "交易所撮合成交"},
                {"id": "clearing", "label": "清算机构算清谁欠谁多少"}
            ],
            "order": ["buy", "broker", "match", "clearing", "custody", "register", "regulate"],
            "finishRequireId": "4.4.flow.done"
        }
    },
    "chapterEnd": {
        "settlementPanelId": None,
        "confirmPanelId": "panel.confirm",
        "understandingChoiceId": None
    },
    "beats": [
        {
            "id": "4.1",
            "title": "三栋楼",
            "shell": "hidden",
            "scene": "cityStreet",
            "sceneImageKey": None,
            "mentor": [
                {
                    "timing": "chapterOpen",
                    "speaker": "face",
                    "conceptKey": None,
                    "line": "这一章不花你的钱，只花你的时间。"
                }
            ],
            "panels": ["panel.tower.exchange", "panel.tower.broker", "panel.tower.fund"],
            "panelAutoOpen": False,
            "require": [
                {
                    "kind": "interact",
                    "id": "4.1.openExchange",
                    "label": "交易所",
                    "opensPanel": "panel.tower.exchange",
                    "propStyle": "tower"
                },
                {
                    "kind": "interact",
                    "id": "4.1.openBroker",
                    "label": "证券",
                    "opensPanel": "panel.tower.broker",
                    "propStyle": "tower"
                },
                {
                    "kind": "interact",
                    "id": "4.1.openFund",
                    "label": "基金",
                    "opensPanel": "panel.tower.fund",
                    "propStyle": "tower"
                }
            ],
            "concepts": ["交易所", "券商", "基金管理人"],
            "conceptCards": [],
            "savePoint": False,
            "advanceDay": False,
            "forceEvent": None
        },
        {
            "id": "4.2",
            "title": "谁在定价",
            "shell": "full",
            "scene": None,
            "sceneImageKey": None,
            "mentor": [
                {
                    "timing": "firstConcept",
                    "speaker": "face",
                    "conceptKey": "撮合",
                    "line": "你看这本挂单簿。想买的人报一个价，想卖的人报一个价，价对上了就成一笔 —— 这里的价没有人定，是两边自己撞上的。"
                }
            ],
            "panels": ["panel.orderBook"],
            "panelAutoOpen": True,
            "highlight": "advanceDayButton",
            "require": [
                {
                    "kind": "advanceDay",
                    "id": "4.2.advance",
                    "label": "进入下一交易日",
                    "simAction": ["advanceDay"]
                },
                {
                    "kind": "choice",
                    "id": "4.2.match",
                    "choiceId": "4.2.match",
                    "label": "点选「这一笔是谁和谁成交的」"
                }
            ],
            "concepts": ["撮合", "买卖价差", "流动性"],
            "conceptCards": [],
            "savePoint": False,
            "advanceDay": True,
            "forceEvent": None
        },
        {
            "id": "4.3",
            "title": "配对游戏",
            "shell": "full",
            "scene": None,
            "sceneImageKey": None,
            "mentor": [
                {
                    "timing": "firstConcept",
                    "speaker": "face",
                    "conceptKey": "交易所",
                    "line": "刚才那三栋楼，各有各的活儿。我这儿有六张卡，你把它配到各自做的事上 —— 配不上就换一张，这里不记次数。"
                }
            ],
            "panels": ["panel.matchGame"],
            "panelAutoOpen": True,
            "require": [
                {
                    "kind": "interact",
                    "id": "4.3.match.exchange",
                    "gate": "matchGame",
                    "label": "把「交易所」配到它做的事上"
                },
                {
                    "kind": "interact",
                    "id": "4.3.match.broker",
                    "gate": "matchGame",
                    "label": "把「券商」配到它做的事上"
                },
                {
                    "kind": "interact",
                    "id": "4.3.match.bank",
                    "gate": "matchGame",
                    "label": "把「银行」配到它做的事上"
                },
                {
                    "kind": "interact",
                    "id": "4.3.match.clearing",
                    "gate": "matchGame",
                    "label": "把「清算机构」配到它做的事上"
                },
                {
                    "kind": "interact",
                    "id": "4.3.match.regulator",
                    "gate": "matchGame",
                    "label": "把「监管机构」配到它做的事上"
                },
                {
                    "kind": "interact",
                    "id": "4.3.match.fundManager",
                    "gate": "matchGame",
                    "label": "把「基金管理人」配到它做的事上"
                }
            ],
            "concepts": ["交易所", "券商", "银行", "清算交收", "监管机构", "基金管理人"],
            "conceptCards": [],
            "savePoint": False,
            "advanceDay": False,
            "forceEvent": None
        },
        {
            "id": "4.4",
            "title": "你的钱在哪",
            "shell": "full",
            "scene": None,
            "sceneImageKey": None,
            "mentor": [
                {
                    "timing": "firstConcept",
                    "speaker": "face",
                    "conceptKey": "清算交收",
                    "line": "你点一下「买入」，看上去是一瞬间的事。钱和股票其实要走过好几站 —— 你顺着走一遍，就知道每一站是谁在看账。"
                }
            ],
            "panels": ["panel.flowWalk"],
            "panelAutoOpen": True,
            "require": [
                {
                    "kind": "interact",
                    "id": "4.4.flow.done",
                    "gate": "flowWalk",
                    "label": "按正确顺序点出这笔钱走过的环节"
                }
            ],
            "concepts": ["清算交收", "存管", "监管机构"],
            "conceptCards": [],
            "savePoint": True,
            "advanceDay": False,
            "forceEvent": None
        },
        {
            "id": "4.5",
            "title": "如果券商自己拿了你的钱",
            "shell": "full",
            "scene": None,
            "sceneImageKey": None,
            "mentor": [
                {
                    "timing": "firstConcept",
                    "speaker": "face",
                    "conceptKey": "存管",
                    "line": "我先问你一句：如果没有「客户的钱不能放在券商自己手里」那条规矩，会怎样？"
                }
            ],
            "panels": ["panel.ifNoRule"],
            "panelAutoOpen": True,
            "require": [
                {
                    "kind": "choice",
                    "id": "4.5.ifNoRule",
                    "choiceId": "4.5.ifNoRule",
                    "label": "回答老周的问题（不判对错）"
                }
            ],
            "concepts": ["监管机构", "存管"],
            "conceptCards": [],
            "savePoint": False,
            "advanceDay": False,
            "forceEvent": None
        },
        {
            "id": "4.6",
            "title": "坏消息词条",
            "shell": "full",
            "scene": None,
            "sceneImageKey": None,
            "mentor": [
                {
                    "timing": "firstConcept",
                    "speaker": "face",
                    "conceptKey": "停牌",
                    "line": "坏消息也是市场的一部分。有三个词你迟早会碰上，先看一遍，碰上时不至于慌。"
                }
            ],
            "panels": ["panel.badNews"],
            "panelAutoOpen": True,
            "require": [
                {
                    "kind": "read",
                    "id": "4.6.badNews",
                    "panelId": "panel.badNews",
                    "count": 3,
                    "mustClose": True,
                    "label": "读完 停牌 / 退市 / 黑天鹅 三条词条"
                }
            ],
            "concepts": ["停牌", "退市", "黑天鹅"],
            "conceptCards": [],
            "savePoint": False,
            "advanceDay": False,
            "forceEvent": None
        },
        {
            "id": "4.7",
            "title": "章末",
            "shell": "full",
            "scene": None,
            "sceneImageKey": None,
            "mentor": [
                {
                    "timing": "chapterEnd",
                    "speaker": "face",
                    "conceptKey": None,
                    "line": "你怕的不是市场，是你看不见的那些手。现在你看见它们了。下一章我带你去看一种多了两个变量的东西。"
                }
            ],
            "panels": [],
            "panelAutoOpen": False,
            "require": [
                {"kind": "interact", "id": "4.7.finish", "label": "继续"}
            ],
            "concepts": [],
            "conceptCards": [],
            "savePoint": True,
            "advanceDay": False,
            "endOfChapter": True,
            "forceEvent": None
        }
    ]
}


def main():
    with io.open(PATH, encoding='utf-8', newline='') as fh:
        text = fh.read()
    if not text.endswith(TAIL):
        raise SystemExit('tail mismatch — 拒绝改动')
    if '"id": 4,' in text:
        raise SystemExit('chapter 4 already present — 拒绝重复追加')
    body = json.dumps(CH4, ensure_ascii=False, indent=2)
    body = '\n'.join(('  ' + line) if line else line for line in body.split('\n'))
    new_text = text[: -len(TAIL)] + '    },\n' + body + '\n  ]\n}\n'
    with io.open(PATH, 'w', encoding='utf-8', newline='') as fh:
        fh.write(new_text)
    # 自检
    doc = json.loads(new_text)
    assert len(doc['chapters']) == 4, len(doc['chapters'])
    ch4 = doc['chapters'][3]
    assert ch4['id'] == 4
    assert [b['id'] for b in ch4['beats']] == ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7']
    assert new_text.startswith(text[: -len(TAIL)])
    print('OK: chapters =', [c['id'] for c in doc['chapters']], 'bytes', len(text), '->', len(new_text))


main()
