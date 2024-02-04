# Topic Graph

Explore Wikipedia topics and their relationships through a graph-based network

**Project Status**: prototyping, incomplete

This is a FOSS tool that collects links between Wikipedia topics and builds a graph network. It allows users to search for the shortest path between any two topics within the graph.

## Functionality

- **Data Collection**: The project uses web scraping techniques to collect links between Wikipedia topics. It automatically visits Wikipedia pages, extracts the relevant links, and stores them into a sqlite database.

- **Graph Construction**: The collected links are used to construct a graph network, where each Wikipedia topic is represented as a node, and the out-going links between topics form the directed edges of the graph. This allows for efficient navigation and exploration of related topics.

- **Search for Shortest Path**: Users can search for the shortest path between any two topics within the graph. This can be useful for discovering connections and relationships between different topics on Wikipedia.

- **Graph Visualization**: The project provides a visualization component that allows users to visually explore the graph network. It provides an intuitive and interactive interface for navigating through topics and understanding their relationships.

- **User Interface**: The project includes a user-friendly interface that allows users to interact with the graph, search for topics, and view the shortest path results. The interface provides a seamless experience for discovering and learning about various Wikipedia topics.

- **Extensibility**: The project is designed to be extensible, allowing for future enhancements and additional features. Users can easily add new topics to the graph and incorporate new functionalities based on their specific requirements.

## Getting Started

This project will be hosted on a server and open to the public.

However, if you want to run it locally, below are the steps:

- Install the necessary dependencies and libraries.

- Run the data collection process to collect links between Wikipedia topics and build the graph database.

- Launch the user interface to interact with the graph, search for topics, and find the shortest path between them.

- Explore the graph, discover connections between topics, and gain insights into the vast amount of knowledge available on Wikipedia.

## License

This project is licensed with [BSD-2-Clause](./LICENSE)

This is free, libre, and open-source software. It comes down to four essential freedoms [[ref]](https://seirdy.one/2021/01/27/whatsapp-and-the-domestication-of-users.html#fnref:2):

- The freedom to run the program as you wish, for any purpose
- The freedom to study how the program works, and change it so it does your computing as you wish
- The freedom to redistribute copies so you can help others
- The freedom to distribute copies of your modified versions to others
