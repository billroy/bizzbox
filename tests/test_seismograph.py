"""The seismic stream must preserve event samples in append deltas."""
from server.generators.seismograph import SeismographActivity


def test_event_waveform_reaches_rolling_client_buffer():
    gen = SeismographActivity()
    gen._noise = lambda sigma_override=None: 0.0
    gen._mag_min = gen._mag_max = 5.0
    gen._event_countdown = 1

    client = gen.initial_payload()
    saw_event_peak = False
    for _ in range(18):
        frame = gen.next_frame()
        delta = gen.compute_delta(client, frame)
        for channel, append, expected in zip(client["channels"], delta["append"], frame["channels"]):
            channel["samples"] = channel["samples"][len(append):] + append
            assert channel["samples"] == expected["samples"]
        saw_event_peak |= any(abs(v) > 0.3 for ch in client["channels"]
                              for v in ch["samples"])
        client["magnitude"] = delta["magnitude"]

    assert saw_event_peak
    assert client["magnitude"] is None
