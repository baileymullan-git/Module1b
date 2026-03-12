import { useEffect, useMemo, useState } from "react";

const POLICE_API_BASE = "https://data.police.uk/api";

function getLastCompleteMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function stripHtml(value) {
  return value ? value.replace(/<[^>]*>/g, "").trim() : "";
}

function formatPopulation(value) {
  if (value === null || value === undefined) {
    return "Not published";
  }

  const normalized =
    typeof value === "string" ? value.trim().replace(/,/g, "") : value;

  if (normalized === "") {
    return "Not published";
  }

  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) {
    if (numeric <= 0) {
      return "Not published";
    }
    return numeric.toLocaleString("en-GB");
  }

  return String(value);
}

function aggregateCrimeCategories(crimes) {
  const counts = crimes.reduce((acc, crime) => {
    const key = crime.category || "other-crime";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }
  return response.json();
}

export default function App() {
  const [forces, setForces] = useState([]);
  const [selectedForce, setSelectedForce] = useState("");
  const [forceProfile, setForceProfile] = useState(null);
  const [neighbourhoods, setNeighbourhoods] = useState([]);
  const [neighbourhoodQuery, setNeighbourhoodQuery] = useState("");
  const [selectedNeighbourhood, setSelectedNeighbourhood] = useState("");
  const [neighbourhoodDetails, setNeighbourhoodDetails] = useState(null);
  const [events, setEvents] = useState([]);
  const [boundary, setBoundary] = useState([]);
  const [crimePoint, setCrimePoint] = useState(null);
  const [crimeDate, setCrimeDate] = useState(getLastCompleteMonth());
  const [crimeSummary, setCrimeSummary] = useState([]);
  const [loading, setLoading] = useState({
    forces: false,
    forceData: false,
    neighbourhoodData: false,
    crimes: false
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading((prev) => ({ ...prev, forces: true }));
    setError("");

    fetchJson(`${POLICE_API_BASE}/forces`, controller.signal)
      .then((data) => setForces(data))
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("Could not load police forces from the API.");
        }
      })
      .finally(() => setLoading((prev) => ({ ...prev, forces: false })));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedForce) {
      setForceProfile(null);
      setNeighbourhoods([]);
      setSelectedNeighbourhood("");
      setNeighbourhoodDetails(null);
      setEvents([]);
      setBoundary([]);
      setCrimePoint(null);
      setCrimeSummary([]);
      return;
    }

    const controller = new AbortController();
    setLoading((prev) => ({ ...prev, forceData: true }));
    setError("");
    setSelectedNeighbourhood("");
    setNeighbourhoodDetails(null);
    setEvents([]);
    setBoundary([]);
    setCrimePoint(null);
    setCrimeSummary([]);

    Promise.all([
      fetchJson(`${POLICE_API_BASE}/forces/${selectedForce}`, controller.signal),
      fetchJson(`${POLICE_API_BASE}/${selectedForce}/neighbourhoods`, controller.signal)
    ])
      .then(([forceData, neighbourhoodData]) => {
        setForceProfile(forceData);
        setNeighbourhoods(neighbourhoodData);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("Could not load data for this police force.");
        }
      })
      .finally(() => setLoading((prev) => ({ ...prev, forceData: false })));

    return () => controller.abort();
  }, [selectedForce]);

  useEffect(() => {
    if (!selectedForce || !selectedNeighbourhood) {
      setNeighbourhoodDetails(null);
      setEvents([]);
      setBoundary([]);
      setCrimePoint(null);
      setCrimeSummary([]);
      return;
    }

    const controller = new AbortController();
    setLoading((prev) => ({ ...prev, neighbourhoodData: true }));
    setError("");

    Promise.all([
      fetchJson(
        `${POLICE_API_BASE}/${selectedForce}/${selectedNeighbourhood}`,
        controller.signal
      ),
      fetchJson(
        `${POLICE_API_BASE}/${selectedForce}/${selectedNeighbourhood}/events`,
        controller.signal
      ),
      fetchJson(
        `${POLICE_API_BASE}/${selectedForce}/${selectedNeighbourhood}/boundary`,
        controller.signal
      )
    ])
      .then(([detailsData, eventsData, boundaryData]) => {
        setNeighbourhoodDetails(detailsData);
        setEvents(eventsData);
        setBoundary(boundaryData);
        if (boundaryData.length > 0) {
          setCrimePoint({
            lat: boundaryData[0].latitude,
            lng: boundaryData[0].longitude
          });
        } else {
          setCrimePoint(null);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("Could not load neighbourhood details for the selected area.");
        }
      })
      .finally(() =>
        setLoading((prev) => ({ ...prev, neighbourhoodData: false }))
      );

    return () => controller.abort();
  }, [selectedForce, selectedNeighbourhood]);

  useEffect(() => {
    if (!crimePoint?.lat || !crimePoint?.lng || !crimeDate) {
      setCrimeSummary([]);
      return;
    }

    const controller = new AbortController();
    setLoading((prev) => ({ ...prev, crimes: true }));
    setError("");

    fetchJson(
      `${POLICE_API_BASE}/crimes-street/all-crime?lat=${crimePoint.lat}&lng=${crimePoint.lng}&date=${crimeDate}`,
      controller.signal
    )
      .then((crimeData) => setCrimeSummary(aggregateCrimeCategories(crimeData)))
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("Could not load crime summaries for this month.");
        }
      })
      .finally(() => setLoading((prev) => ({ ...prev, crimes: false })));

    return () => controller.abort();
  }, [crimeDate, crimePoint]);

  const filteredNeighbourhoods = useMemo(() => {
    const query = neighbourhoodQuery.trim().toLowerCase();
    if (!query) {
      return neighbourhoods;
    }
    return neighbourhoods.filter((item) =>
      item.name.toLowerCase().includes(query)
    );
  }, [neighbourhoodQuery, neighbourhoods]);

  const totalCrimeCount = crimeSummary.reduce((sum, item) => sum + item.total, 0);
  const topCrimeCount = crimeSummary[0]?.total || 0;

  return (
    <main className="app-shell">
      <section className="hero panel">
        <p className="tag">UK Government Open Data</p>
        <h1>Neighbourhood Pulse</h1>
        <p>
          Explore UK neighbourhood policing information by force, area, and
          month. Data comes live from the public Police API and contains only
          unclassified information.
        </p>
      </section>

      <section className="panel controls">
        <h2>1) Choose A Police Force</h2>
        <label htmlFor="force-select">Police force</label>
        <select
          id="force-select"
          value={selectedForce}
          onChange={(event) => setSelectedForce(event.target.value)}
          disabled={loading.forces}
        >
          <option value="">Select a force...</option>
          {forces.map((force) => (
            <option key={force.id} value={force.id}>
              {force.name}
            </option>
          ))}
        </select>

        <div className="status-row">
          {loading.forces && <p className="status">Loading forces...</p>}
          {loading.forceData && <p className="status">Loading force profile...</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </section>

      <section className="panel grid-2">
        <article>
          <h2>2) Force Profile</h2>
          {!selectedForce && <p>Select a force to load data.</p>}
          {forceProfile && (
            <div className="detail-list">
              <p>
                <strong>Name:</strong> {forceProfile.name}
              </p>
              <p>
                <strong>Website:</strong>{" "}
                {forceProfile.url ? (
                  <a href={forceProfile.url} target="_blank" rel="noreferrer">
                    {forceProfile.url}
                  </a>
                ) : (
                  "Not provided"
                )}
              </p>
              <p>
                <strong>Engagement Channels:</strong>{" "}
                {forceProfile.engagement_methods?.length || 0}
              </p>
            </div>
          )}
        </article>

        <article>
          <h2>3) Pick A Neighbourhood</h2>
          <label htmlFor="neighbourhood-search">Filter areas</label>
          <input
            id="neighbourhood-search"
            type="text"
            placeholder="Search by name..."
            value={neighbourhoodQuery}
            onChange={(event) => setNeighbourhoodQuery(event.target.value)}
            disabled={!selectedForce || loading.forceData}
          />

          <label htmlFor="neighbourhood-select">Neighbourhood</label>
          <select
            id="neighbourhood-select"
            value={selectedNeighbourhood}
            onChange={(event) => setSelectedNeighbourhood(event.target.value)}
            disabled={!selectedForce || loading.forceData}
          >
            <option value="">Select an area...</option>
            {filteredNeighbourhoods.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <p className="meta">
            Showing {filteredNeighbourhoods.length} of {neighbourhoods.length} areas.
          </p>
        </article>
      </section>

      <section className="panel grid-2">
        <article>
          <h2>4) Area Detail</h2>
          {loading.neighbourhoodData && <p className="status">Loading area details...</p>}
          {!selectedNeighbourhood && <p>Select an area to load details, events, and boundary points.</p>}
          {neighbourhoodDetails && (
            <div className="detail-list">
              <p>
                <strong>Area:</strong> {neighbourhoodDetails.name}
              </p>
              <p>
                <strong>Population:</strong>{" "}
                {formatPopulation(neighbourhoodDetails.population)}
              </p>
              <p>
                <strong>Description:</strong>{" "}
                {stripHtml(neighbourhoodDetails.description) || "No description available."}
              </p>
              <p>
                <strong>Boundary Points:</strong> {boundary.length}
              </p>
            </div>
          )}
        </article>

        <article>
          <h2>5) Events In Area</h2>
          {!selectedNeighbourhood && <p>Events will appear here when an area is selected.</p>}
          {selectedNeighbourhood && events.length === 0 && !loading.neighbourhoodData && (
            <p>No upcoming events published for this neighbourhood.</p>
          )}
          {events.length > 0 && (
            <ul className="event-list">
              {events.map((event) => (
                <li key={event.id}>
                  <p>
                    <strong>{event.title}</strong>
                  </p>
                  <p>
                    {event.start_date
                      ? `${event.start_date} at ${event.address || "Location TBC"}`
                      : "Date not published"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>6) Monthly Crime Snapshot (Boundary Sample Point)</h2>
        <p className="meta">
          Uses the first available boundary coordinate for this area and
          summarizes category totals for the selected month.
        </p>

        <label htmlFor="crime-date">Crime month</label>
        <input
          id="crime-date"
          type="month"
          value={crimeDate}
          onChange={(event) => setCrimeDate(event.target.value)}
          disabled={!crimePoint}
        />

        {loading.crimes && <p className="status">Loading crime summary...</p>}
        {!loading.crimes && crimePoint && crimeSummary.length === 0 && (
          <p>No crimes returned for this point and month.</p>
        )}
        {crimeSummary.length > 0 && (
          <div className="crime-block">
            <p className="meta">
              Total records: {totalCrimeCount} | Top category share:{" "}
              {Math.round((topCrimeCount / totalCrimeCount) * 100)}%
            </p>
            <ul className="crime-list">
              {crimeSummary.slice(0, 10).map((item) => (
                <li key={item.category}>
                  <span className="crime-label">
                    {item.category.replaceAll("-", " ")}
                  </span>
                  <span className="crime-value">{item.total}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
