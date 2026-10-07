import copy
import struct
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import C
from wire_command import build_mqtt_message, CommandError
from wire_decode import crc16_ccitt_false
from command_ack import find_thermo_for_command

CHANNELS = [
    dict(channel='A', eqpmnCode='EC01', setpointTemp=25, tempDeviation=2, minVentPct=10, maxVentPct=100),
    dict(channel='B', eqpmnCode='EC02', setpointTemp=24, tempDeviation=1.5, minVentPct=20, maxVentPct=80),
    dict(channel='C', eqpmnCode='EC03', setpointTemp=23.5, tempDeviation=3, minVentPct=30, maxVentPct=90),
]
ROW = dict(id='offline-test', lsind_regist_no='TEST', item_code='P00', module_uid=1,
    stall_ty_code='SP01', stall_no='01', eqpmn_no='03', action='SET_CHANNELS_THERMO',
    setpoint_temp=25, temp_deviation=2, min_vent_pct=10, max_vent_pct=100,
    payload_json={'command_channels': CHANNELS})

class CombinedCommandTests(unittest.TestCase):
    def test_wire(self):
        topic, wire, payload = build_mqtt_message(ROW)
        self.assertEqual(topic, 'sungil/TEST/P00/cmd')
        self.assertEqual(len(wire), 29)
        self.assertEqual(wire[:6], bytes([13, 0, 1, 1, 3, 7]))
        self.assertEqual(wire[6:13], struct.pack('<BHHBB', 1, 250, 20, 10, 100))
        self.assertEqual(wire[13:20], struct.pack('<BHHBB', 2, 240, 15, 20, 80))
        self.assertEqual(wire[20:27], struct.pack('<BHHBB', 3, 235, 30, 30, 90))
        self.assertEqual(struct.unpack('<H', wire[27:])[0], crc16_ccitt_false(wire[:27]))
        self.assertEqual(payload['command_channels'], CHANNELS)
        self.assertEqual(payload['wire_ver'], 13)
        print('GOLDEN_HEX', wire.hex())

    def test_only_b(self):
        row=copy.deepcopy(ROW); row['payload_json']['command_channels']=[CHANNELS[1]]
        wire=build_mqtt_message(row)[1]
        self.assertEqual(wire[5], 2)
        self.assertEqual(wire[6:13], b'\xff'*7)
        self.assertEqual(wire[20:27], b'\xff'*7)

    def test_reject(self):
        for channels in ([], [CHANNELS[0], CHANNELS[0]], [dict(CHANNELS[0], minVentPct=101)],
                         [dict(CHANNELS[0], tempDeviation=20)], [dict(CHANNELS[0], setpointTemp=float('nan'))]):
            row=copy.deepcopy(ROW); row['payload_json']['command_channels']=channels
            with self.assertRaises(CommandError): build_mqtt_message(row)

    def test_ack_all_channels(self):
        live={f"SP01:01:03|{c['channel']}|{c['eqpmnCode']}":dict(c) for c in CHANNELS}
        self.assertIsNotNone(find_thermo_for_command(ROW, live))
        live['SP01:01:03|C|EC03']['setpointTemp']=20
        self.assertIsNone(find_thermo_for_command(ROW, live))
        del live['SP01:01:03|C|EC03']
        self.assertIsNone(find_thermo_for_command(ROW, live))

    def test_one_publication_and_one_ack_gate(self):
        published=[]
        def publish(topic,body,**kwargs):
            published.append((topic,body))
            return SimpleNamespace(rc=0,wait_for_publish=lambda timeout:None)
        with patch.object(C,'mark_sent') as sent,patch.object(C,'wait_for_applied',return_value='applied') as ack:
            self.assertEqual(C.gate_send_one(SimpleNamespace(publish=publish),ROW),'applied')
            self.assertEqual(len(published),1)
            self.assertEqual(len(published[0][1]),29)
            self.assertEqual(sent.call_count,1)
            self.assertEqual(ack.call_count,1)

    def test_overlapping_bundles_not_discarded(self):
        first=copy.deepcopy(ROW); first['id']='old-ab'; first['payload_json']['command_channels']=CHANNELS[:2]
        second=copy.deepcopy(ROW); second['id']='new-a'; second['payload_json']['command_channels']=CHANNELS[:1]
        with patch.object(C,'DEDUPE_PENDING',True):
            send,cancel=C.dedupe_pending_rows([first,second])
        self.assertEqual(len(send),2)
        self.assertEqual(cancel,[])

    def test_legacy(self):
        row=dict(ROW, action='SET_CHANNEL_THERMO', channel='A', eqpmn_code='EC01')
        wire=build_mqtt_message(row)[1]
        self.assertEqual(len(wire), 15)
        self.assertEqual(wire[0], 12)

if __name__ == '__main__': unittest.main()
