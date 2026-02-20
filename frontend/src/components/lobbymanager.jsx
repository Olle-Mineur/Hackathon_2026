import { useState } from "react";

const LobbyManager = () => {
  const [hostName, setHostName] = useState("");
  const [lobbyCode, setLobbyCode] = useState("");
  const [activeTab, setActiveTab] = useState("create");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateLobby = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!hostName.trim()) {
      setError("Please enter a nickname");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: hostName.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to create lobby");
      }

      const data = await response.json();
      const code = data?.session?.code;
      setSuccess(`Lobby created! Code: ${code}`);
    } catch (err) {
      setError(err.message || "Failed to create lobby");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinLobby = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!hostName.trim()) {
      setError("Please enter a nickname");
      return;
    }

    if (!lobbyCode.trim()) {
      setError("Please enter a lobby code");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/lobbies/${lobbyCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: hostName.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to join lobby");
      }

      setSuccess(`Joined lobby ${lobbyCode}!`);
    } catch (err) {
      setError(err.message || "Failed to join lobby");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nickname
        </label>
        <input
          type="text"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          placeholder="Enter your nickname"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          maxLength={20}
          disabled={isLoading}
        />
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setActiveTab("create");
            setError("");
            setSuccess("");
          }}
          disabled={isLoading}
          className={`flex-1 py-2 rounded-md font-medium transition-colors ${
            activeTab === "create"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          } disabled:opacity-50`}
        >
          Create
        </button>
        <button
          onClick={() => {
            setActiveTab("join");
            setError("");
            setSuccess("");
          }}
          disabled={isLoading}
          className={`flex-1 py-2 rounded-md font-medium transition-colors ${
            activeTab === "join"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          } disabled:opacity-50`}
        >
          Join
        </button>
      </div>

      {/* Create Form */}
      {activeTab === "create" && (
        <form onSubmit={handleCreateLobby}>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isLoading ? "Creating..." : "Create New Lobby"}
          </button>
        </form>
      )}

      {/* Join Form */}
      {activeTab === "join" && (
        <form onSubmit={handleJoinLobby}>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lobby Code
            </label>
            <input
              type="text"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase disabled:bg-gray-100"
              maxLength={30}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isLoading ? "Joining..." : "Join Lobby"}
          </button>
        </form>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}
    </div>
  );
};

export default LobbyManager;
